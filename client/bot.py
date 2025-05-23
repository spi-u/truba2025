"""
Telegram bot that listens to voice messages, transcribes them using Vosk,
and saves them to a database.
"""
import os
import logging
from telegram import Update
from telegram.ext import (
    Updater, CommandHandler, MessageHandler, 
    Filters, CallbackContext
)
import tempfile

# Import our modules
from config import TELEGRAM_TOKEN, TEMP_DIR
from speech_recognition import transcribe_audio
from database import init_db, save_message

# Set up logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def start(update: Update, context: CallbackContext) -> None:
    """Send a message when the command /start is issued."""
    user = update.effective_user
    update.message.reply_text(
        f'Hi {user.first_name}! I can transcribe your voice messages. '
        f'Send me a voice message and I\'ll convert it to text.'
    )

def help_command(update: Update, context: CallbackContext) -> None:
    """Send a message when the command /help is issued."""
    update.message.reply_text(
        'This bot transcribes voice messages. Just send a voice message and I\'ll convert it to text.'
    )

def process_voice(update: Update, context: CallbackContext) -> None:
    """Process voice messages and transcribe them."""
    user = update.effective_user
    message = update.message
    voice = message.voice
    
    # Send a status message
    status_message = update.message.reply_text("Processing your voice message...")
    
    try:
        # Download the voice message
        voice_file = context.bot.get_file(voice.file_id)
        
        # Create a temporary file to save the voice message
        temp_file_path = os.path.join(TEMP_DIR, f"{voice.file_id}.ogg")
        voice_file.download(temp_file_path)
        
        # Transcribe the voice message
        logger.info(f"Transcribing voice message from user {user.id}")
        transcribed_text = transcribe_audio(temp_file_path)
        
        # Clean up temporary file
        os.remove(temp_file_path)
        
        if transcribed_text and transcribed_text.strip():
            # Save to database
            save_message(user.id, transcribed_text)
            
            # Reply with transcribed text
            status_message.edit_text(f"Transcription: {transcribed_text}")
            logger.info(f"Successfully transcribed and saved message from user {user.id}")
        else:
            status_message.edit_text("Sorry, I couldn't transcribe your message. Please try again.")
            logger.warning(f"Failed to transcribe message from user {user.id}")
            
    except Exception as e:
        logger.error(f"Error processing voice message: {e}")
        status_message.edit_text("An error occurred while processing your voice message.")

def main() -> None:
    """Start the bot."""
    # Initialize database
    init_db()
    
    # Create the Updater and pass it your bot's token
    updater = Updater(TELEGRAM_TOKEN)
    
    # Get the dispatcher to register handlers
    dispatcher = updater.dispatcher
    
    # Register command handlers
    dispatcher.add_handler(CommandHandler("start", start))
    dispatcher.add_handler(CommandHandler("help", help_command))
    
    # Register message handlers
    dispatcher.add_handler(MessageHandler(Filters.voice, process_voice))
    
    # Start the Bot
    updater.start_polling()
    logger.info("Bot started")
    
    # Run the bot until you press Ctrl-C
    updater.idle()

if __name__ == '__main__':
    main()
