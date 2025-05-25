FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for better layer caching
COPY agent-core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Expose the WebSocket port
EXPOSE 8765

# Run the WebSocket server
CMD ["python", "websocket_server.py"]
