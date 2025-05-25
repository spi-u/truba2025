import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Stream } from 'stream';

import axios from 'axios';
import { Telegraf } from 'telegraf';
import * as websocket from 'ws';

import { Command } from '../shared/command';
import { BotContext } from '../shared/context';

export class VoiceCommand extends Command {
  private tempDir: string;
  private ws: websocket.WebSocket | null = null;
  private agentSessionId: string | null = null;
  private readonly agentWsUrl: string;

  constructor(bot: Telegraf<BotContext>) {
    super(bot);
    // Create a subdirectory in the system's temp directory for voice files
    this.tempDir = path.join(os.tmpdir(), 'telegram-voice-files');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Set up the WebSocket URL for the agent server
    this.agentWsUrl = process.env.AGENT_WS_URL || 'ws://agent-core:8765';

    // Initialize connection to agent WebSocket server
    this.connectToAgentServer();
  }

  handle() {
    // Handle voice messages
    this.bot.on('voice', async (ctx) => {
      try {
        // Send an initial message to indicate processing
        const processingMsg = await ctx.reply(
          '🎤 Processing your voice message...',
        );

        const message = ctx.message;
        const fileId = message.voice.file_id;

        // Get file info from Telegram
        const fileInfo = await ctx.telegram.getFile(fileId);
        if (!fileInfo || !fileInfo.file_path) {
          throw new Error('Could not get file info');
        }

        // Generate file paths
        const originalFilename = `voice_${message.from.id}_${Date.now()}`;
        const oggFilePath = path.join(this.tempDir, `${originalFilename}.ogg`);
        const wavFilePath = path.join(this.tempDir, `${originalFilename}.wav`);

        // Download the voice file (ogg format)
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
        const response = await axios({
          method: 'GET',
          url: fileUrl,
          responseType: 'stream',
        });

        const writer = fs.createWriteStream(oggFilePath);
        (response.data as Stream).pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        // Convert OGG to WAV for speech recognition
        await this.convertOggToWav(oggFilePath, wavFilePath);

        // Perform speech recognition if model is available
        const transcription = await this.performSpeechRecognition(wavFilePath);

        if (!transcription) {
          return ctx.telegram.editMessageText(
            ctx.chat.id,
            processingMsg.message_id,
            undefined,
            `🎤 Я не смог распознать, что вы сказали`,
          );
        }
        // Update the processing message with the transcription result

        // If we have a valid transcription, send it to the agent
        if (transcription && transcription.trim().length > 0) {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            processingMsg.message_id,
            undefined,
            `🎤 Я вас услышал!\n\n🤖 AI помощник думает...`,
          );

          try {
            // Send the transcription to the agent and get response
            const agentResponse = await this.queryAgent(transcription);

            // Update the message with the agent's response
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              processingMsg.message_id,
              undefined,
              `🤖 Ответ помощника:\n${agentResponse}`,
            );
          } catch (error) {
            console.error('Error querying agent:', error);
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              processingMsg.message_id,
              undefined,
              `🎤 Я вас услышал!\n\n❌ Ошибка работы AI помощника`,
            );
          }
        }

        return {
          success: true,
          filePath: wavFilePath,
          duration: message.voice.duration,
          transcription,
        };
      } catch (error) {
        console.error('Error handling voice message:', error);
        await ctx.reply(
          'Sorry, there was an error processing your voice message.',
        );
        return { success: false, error };
      }
    });
  }

  private connectToAgentServer(): void {
    try {
      // Close any existing connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
        this.agentSessionId = null;
      }

      // Create new WebSocket connection
      this.ws = new websocket.WebSocket(this.agentWsUrl);

      this.ws.on('open', () => {
        console.log('Connected to agent WebSocket server');
        // Login to create a session
        if (this.ws) {
          this.ws.send(
            JSON.stringify({
              event: 'login',
              data: {},
            }),
          );
        }
      });

      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          console.log('Agent WebSocket response:', response);

          // Handle login response
          if (
            response.event === 'login_response' &&
            response.data.status === 'success'
          ) {
            this.agentSessionId = response.data.session_id;
            console.log(`Agent session created: ${this.agentSessionId}`);
          }
        } catch (error) {
          console.error('Error parsing agent WebSocket response:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from agent WebSocket server');
        this.ws = null;
        this.agentSessionId = null;

        // Try to reconnect after a delay
        setTimeout(() => this.connectToAgentServer(), 5000);
      });

      this.ws.on('error', (error) => {
        console.error('Agent WebSocket error:', error);
        // The connection will be closed automatically after an error
      });
    } catch (error) {
      console.error('Error connecting to agent WebSocket server:', error);
      // Try to reconnect after a delay
      setTimeout(() => this.connectToAgentServer(), 5000);
    }
  }

  private async queryAgent(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Ensure we have a connection and session
      if (!this.ws || this.ws.readyState !== websocket.WebSocket.OPEN) {
        this.connectToAgentServer();
        reject(new Error('WebSocket not connected'));
        return;
      }

      if (!this.agentSessionId) {
        reject(new Error('No active agent session'));
        return;
      }

      let taskId: string | null = null;
      let finalResponse = ''; // Initialize as empty string instead of null
      let errorOccurred = false;

      // Set up message handler
      const messageHandler = (data: websocket.Data) => {
        try {
          const response = JSON.parse(data.toString());

          // If we received the request confirmation, store the task ID
          if (response.event === 'agent_request_received') {
            taskId = response.data.task_id;
            console.log(`Agent request received, task ID: ${taskId}`);
          }

          // If we received the final response
          if (
            response.event === 'agent_response' &&
            response.data.task_id === taskId
          ) {
            finalResponse = response.data.response || '';
            // Resolve the promise with the agent's response
            resolve(finalResponse);

            // Clean up the message handler
            if (this.ws) {
              this.ws.removeListener('message', messageHandler);
            }
          }

          // Handle errors
          if (response.event === 'error') {
            errorOccurred = true;
            console.error('Agent error:', response.data.message);
            // reject(new Error(response.data.message));

            // Clean up the message handler
            // if (this.ws) {
            //   this.ws.removeListener('message', messageHandler);
            // }
          }
        } catch (error) {
          console.error('Error parsing agent response:', error);
        }
      };

      // Add the message handler
      this.ws.on('message', messageHandler);

      // Set a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        if (!errorOccurred) {
          // Clean up the message handler
          if (this.ws) {
            this.ws.removeListener('message', messageHandler);
          }
          reject(new Error('Timeout waiting for agent response'));
        }
      }, 60000); // 60 second timeout

      // Send the request
      this.ws.send(
        JSON.stringify({
          event: 'agent_request',
          data: {
            message,
          },
        }),
      );
    });
  }

  private async convertOggToWav(
    oggPath: string,
    wavPath: string,
  ): Promise<void> {
    // This implementation requires ffmpeg to be installed on the system
    return new Promise((resolve, reject) => {
      exec(
        // Convert to 16kHz, 16-bit, mono WAV for better recognition with VOSK
        `ffmpeg -i "${oggPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}"`,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            console.error('Error converting audio:', error);
            reject(error);
            return;
          }
          resolve();
        },
      );
    });
  }

  private async performSpeechRecognition(wavFilePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Use WebSocket to connect to Vosk server
        const uri = process.env.VOSK_SERVER_URL || 'ws://vosk:2700';
        const ws = new websocket.WebSocket(uri);

        let finalResult = '';

        ws.on('open', async () => {
          try {
            // Read the WAV file
            const wavFile = fs.readFileSync(wavFilePath);
            // Create a way to read the WAV header to get the sample rate
            const sampleRate = 16000; // Default to 16kHz, typically used for speech recognition

            // Send the configuration
            ws.send(JSON.stringify({ config: { sample_rate: sampleRate } }));

            // Skip the WAV header (44 bytes) for raw PCM data
            const audioData = wavFile.slice(44);

            // Calculate buffer size (0.2 seconds of audio)
            const bufferSize = Math.floor(sampleRate * 0.2);
            // Convert bytes to samples (16-bit audio = 2 bytes per sample)
            const bytesPerSample = 2;
            const bufferSizeBytes = bufferSize * bytesPerSample;

            // Send audio data in chunks
            for (
              let offset = 0;
              offset < audioData.length;
              offset += bufferSizeBytes
            ) {
              const chunk = audioData.slice(offset, offset + bufferSizeBytes);
              if (chunk.length === 0) break;

              ws.send(chunk);

              // Wait for the response (optional: can make this more efficient)
              await new Promise<void>((r) => setTimeout(r, 10)); // Small delay to not overwhelm the server
            }

            // Send EOF signal
            ws.send(JSON.stringify({ eof: 1 }));
          } catch (error) {
            console.error('Error sending data to WebSocket server:', error);
            ws.close();
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const response = JSON.parse(data.toString());
            finalResult = response.partial || response.text || '';
            console.log('WebSocket response:', response);
          } catch (error) {
            console.error('Error parsing WebSocket response:', error);
          }
        });

        ws.on('close', () => {
          resolve(finalResult);
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });
      } catch (error) {
        console.error('Speech recognition error:', error);
        reject(error);
      }
    });
  }
}
