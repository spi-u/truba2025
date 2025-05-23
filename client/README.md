# Voice Message Telegram Bot

A Telegram bot that listens to voice messages, transcribes them using Vosk, and saves them to a database.

## Features

- Listens to voice messages sent to the bot
- Uses Vosk for speech-to-text conversion
- Stores messages in a database with Telegram user ID and transcribed text
- Responds with the transcribed text

## Prerequisites

- Python 3.7+
- A Telegram Bot Token (obtain from [@BotFather](https://t.me/botfather))
- Vosk speech recognition model

## Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

2. Download a Vosk model:

```bash
# Create a directory for the model
mkdir -p vosk-model

# Download a model (this example uses the small English model)
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip -d ./
mv vosk-model-small-en-us-0.15 vosk-model
```

You can find more models at https://alphacephei.com/vosk/models

3. Create a `.env` file with your Telegram token:

```
TELEGRAM_TOKEN=your_telegram_bot_token
DATABASE_URL=sqlite:///messages.db
VOSK_MODEL_PATH=./vosk-model
```

## Usage

1. Start the bot:

```bash
python bot.py
```

2. Open Telegram and start a conversation with your bot
3. Send a voice message to the bot
4. The bot will transcribe the message and send back the text
5. The message will be stored in the database

## Project Structure

- `bot.py`: Main Telegram bot implementation
- `config.py`: Configuration settings
- `database.py`: Database models and functions
- `speech_recognition.py`: Voice transcription using Vosk
- `requirements.txt`: Required Python packages

## Database

The application uses SQLAlchemy with a default SQLite database. The database contains a single table:

- **messages**: Stores transcribed messages with the following fields:
  - `id`: Unique message ID (primary key)
  - `tg_id`: Telegram user ID
  - `message`: Transcribed message text
  - `timestamp`: When the message was received

## Customization

- To use a different database, update the `DATABASE_URL` in the `.env` file
- To use a different Vosk model, update the `VOSK_MODEL_PATH` in the `.env` file
