"""
Configuration for the Telegram bot
"""
import os
from dotenv import load_dotenv

# Try to load environment variables from .env file
load_dotenv()

# Telegram Bot Token - Replace with your actual token or set as environment variable
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "YOUR_TELEGRAM_TOKEN")

# Database connection string
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///messages.db")

# Path to Vosk model
VOSK_MODEL_PATH = os.getenv("VOSK_MODEL_PATH", "./vosk-model")

# Define paths for temporary files
TEMP_DIR = "./temp"
os.makedirs(TEMP_DIR, exist_ok=True)
