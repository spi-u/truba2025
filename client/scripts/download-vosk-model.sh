#!/bin/bash
# Script to download and set up VOSK model for speech recognition

# Create models directory if it doesn't exist
mkdir -p models/vosk

# Download small English model
MODEL_URL="https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
MODEL_ZIP="models/vosk/vosk-model-small-en-us.zip"
MODEL_DIR="models/vosk-model-small-en-us"

echo "Downloading VOSK model from $MODEL_URL..."
curl -L -o $MODEL_ZIP $MODEL_URL

echo "Extracting model..."
unzip -q $MODEL_ZIP -d models/
mv models/vosk-model-small-en-us-0.15 $MODEL_DIR

echo "Cleaning up..."
rm $MODEL_ZIP

echo "VOSK model installed successfully at $MODEL_DIR"
echo "You can now use the VoiceCommand with speech-to-text functionality!"
