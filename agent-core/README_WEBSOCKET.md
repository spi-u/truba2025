# WebSocket Server for AI Agent Integration

This WebSocket server integrates with the existing AI agent in `test.py` to provide a way to interact with the agent through WebSocket connections.

## Features

- **Login System**: Creates a unique session for each client with its own agent instance
- **Event Streaming**: Streams agent events in real-time to the client (tool calls, tool results, outputs)
- **Concurrent Processing**: Handles multiple concurrent requests from different clients
- **Request Cancellation**: Allows cancelling in-progress agent requests

## Message Format

All messages use JSON format with an `event` field and a `data` field:

```json
{
  "event": "event_type",
  "data": {
    // Event-specific data
  }
}
```

## Client Events

Clients can send the following events:

| Event | Description | Data Fields |
|-------|-------------|------------|
| `login` | Authenticates and creates a session | `{}` (empty for now) |
| `agent_request` | Sends a message to the agent | `{"message": "user message"}` |
| `cancel_request` | Cancels an in-progress request | `{"task_id": "id of task to cancel"}` |
| `logout` | Ends the session | `{}` |

## Server Events

The server sends the following events:

| Event | Description | Data Fields |
|-------|-------------|------------|
| `login_response` | Response to login | `{"session_id": "unique session id", "status": "success"}` |
| `agent_request_received` | Confirms request receipt | `{"task_id": "unique task id"}` |
| `tool_call` | Agent is calling a tool | `{"task_id": "id", "tool_name": "name", "tool_kwargs": {}}` |
| `tool_result` | Result from a tool call | `{"task_id": "id", "tool_name": "name", "tool_output": "result"}` |
| `agent_output` | Intermediate agent output | `{"task_id": "id", "output": "text"}` |
| `agent_response` | Final response from agent | `{"task_id": "id", "response": "final answer"}` |
| `error` | Error occurred | `{"message": "error description", "task_id": "id"?}` |
| `task_cancelled` | Confirms task cancellation | `{"task_id": "id"}` |
| `logout_response` | Response to logout | `{"status": "success"}` |

## Setup

1. Make sure `websockets` is installed:
   ```
   pip install -r requirements.txt
   ```

2. Run the WebSocket server:
   ```
   python websocket_server.py
   ```

3. The server will start on `0.0.0.0:8765` by default

## Example Usage

A client example is provided in `websocket_client_example.py`:

```python
import asyncio
from websocket_client_example import WebSocketClient

async def main():
    client = WebSocketClient()
    await client.connect()
    await client.login()
    
    # Start listening for events
    asyncio.create_task(client.listen_for_events())
    
    # Send a request
    await client.send_agent_request("What time is it?")
    
    # Wait for response
    await asyncio.sleep(10)
    
    # Clean up
    await client.logout()
    await client.close()

if __name__ == "__main__":
    asyncio.run(main())
```

## Handling Concurrent Requests

The server is designed to handle multiple requests concurrently:

1. Each client gets its own session with a dedicated agent instance
2. Multiple clients can connect simultaneously
3. A single client can send multiple requests - they will be processed concurrently
4. Each request is assigned a unique task ID for tracking

If a second request is received while another is processing, both will run independently and the client will receive events for both requests, identified by their task IDs.
