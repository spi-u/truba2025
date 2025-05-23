"""
Speech recognition module using Vosk for the Telegram bot
"""
import json
import os
import wave
from vosk import Model, KaldiRecognizer
from pydub import AudioSegment
import logging
from config import VOSK_MODEL_PATH, TEMP_DIR

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def ensure_model_exists():
    """Check if Vosk model exists, provide instructions if it doesn't"""
    if not os.path.exists(VOSK_MODEL_PATH):
        logger.error(
            f"Vosk model not found at {VOSK_MODEL_PATH}. "
            f"Please download a model from https://alphacephei.com/vosk/models "
            f"and extract it to {VOSK_MODEL_PATH}"
        )
        return False
    return True

def convert_ogg_to_wav(ogg_path):
    """Convert OGG audio file to WAV format for Vosk processing
    
    Args:
        ogg_path (str): Path to the OGG file
        
    Returns:
        str: Path to the converted WAV file
    """
    wav_path = os.path.join(TEMP_DIR, f"{os.path.basename(ogg_path)}.wav")
    
    try:
        audio = AudioSegment.from_file(ogg_path)
        audio = audio.set_channels(1)  # Convert to mono
        audio = audio.set_frame_rate(16000)  # Set sample rate to 16kHz
        audio.export(wav_path, format="wav")
        return wav_path
    except Exception as e:
        logger.error(f"Error converting audio: {e}")
        return None

def transcribe_audio(audio_path):
    """Transcribe audio file to text using Vosk
    
    Args:
        audio_path (str): Path to the audio file (OGG format from Telegram)
        
    Returns:
        str: Transcribed text, or None if transcription failed
    """
    if not ensure_model_exists():
        return None
    
    # Convert OGG to WAV
    wav_path = convert_ogg_to_wav(audio_path)
    if not wav_path:
        return None
    
    try:
        # Load Vosk model
        model = Model(VOSK_MODEL_PATH)
        
        # Open the WAV file
        wf = wave.open(wav_path, "rb")
        
        # Check if the WAV file has the correct format
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
            logger.error("Audio file must be WAV format mono PCM.")
            return None
        
        # Create recognizer
        rec = KaldiRecognizer(model, wf.getframerate())
        rec.SetWords(True)
        
        # Process audio
        result = ""
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                part_result = json.loads(rec.Result())
                result += part_result.get("text", "") + " "
        
        # Get final result
        part_result = json.loads(rec.FinalResult())
        result += part_result.get("text", "")
        
        # Clean up
        wf.close()
        os.remove(wav_path)
        
        return result.strip()
    
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        return None
