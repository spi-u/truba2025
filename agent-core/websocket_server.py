import asyncio
import json
import logging
import uuid
import websockets
from dotenv import load_dotenv
import os
from typing import Dict, Any, Set, Optional
from websockets.server import serve
from llama_index.core.workflow import Context
from llama_index.llms.openai import OpenAI
from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.core.agent.workflow import (
    AgentOutput,
    ToolCall,
    ToolCallResult,
    FunctionAgent
)
from llama_index.core import Settings


load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# WebSocket server settings
WS_HOST = "0.0.0.0"
WS_PORT = 8765

llm = OpenAI(
    model="gpt-4o-mini",
    api_key=OPENAI_API_KEY
)
Settings.llm = llm

mcp_client = BasicMCPClient("http://host.docker.internal:8000/sse")
mcp_tools = McpToolSpec(client=mcp_client)

logger.debug(mcp_tools.to_tool_list())

SYSTEM_PROMPT = """\
You are an AI assistant for Tool Calling.

Before you help a user, you need to work with tools to interact with Google Sheets
"""

# Store connected clients and their agents
connected_clients = set()
active_sessions = {}  # Maps session_id to {agent, context, tasks}

class AgentSession:
    """Class to manage agent sessions"""
    
    def __init__(self, session_id: str, agent, context):
        self.session_id = session_id
        self.agent = agent
        self.context = context
        self.active_tasks = {}  # Maps task_id to asyncio tasks
        
    def add_task(self, task_id: str, task: asyncio.Task):
        """Add a task to the session"""
        self.active_tasks[task_id] = task
        
    def remove_task(self, task_id: str):
        """Remove a task from the session"""
        if task_id in self.active_tasks:
            del self.active_tasks[task_id]
            
    def has_active_tasks(self) -> bool:
        """Check if the session has any active tasks"""
        return len(self.active_tasks) > 0

async def handle_client(websocket):
    """Handle WebSocket client connection"""
    client_id = str(uuid.uuid4())
    connected_clients.add(websocket)
    session_id = None
    
    logger.info(f"Client {client_id} connected. Total clients: {len(connected_clients)}")
    
    try:
        async for message in websocket:
            try:
                # Parse incoming message
                data = json.loads(message)
                event_type = data.get("event")
                event_data = data.get("data", {})
                
                logger.info(f"Received event '{event_type}' from client {client_id}")
                
                # Process the event
                if event_type == "login":
                    # Handle login request
                    session_id = await handle_login(websocket, client_id, event_data)
                    await websocket.send(json.dumps({
                        "event": "login_response",
                        "data": {"session_id": session_id, "status": "success"}
                    }))
                    
                elif event_type == "agent_request":
                    # Check if client is logged in
                    print(session_id)
                    if not session_id or session_id not in active_sessions:
                        await websocket.send(json.dumps({
                            "event": "error",
                            "data": {"message": "Not logged in or session expired"}
                        }))
                        continue
                        
                    # Process agent request
                    message_content = event_data.get("message", "")
                    task_id = str(uuid.uuid4())
                    
                    # Start processing in a separate task
                    session = active_sessions[session_id]
                    task = asyncio.create_task(
                        process_agent_request(
                            websocket, 
                            client_id, 
                            session_id, 
                            task_id, 
                            message_content
                        )
                    )
                    session.add_task(task_id, task)
                    
                    # Respond that request is being processed
                    await websocket.send(json.dumps({
                        "event": "agent_request_received",
                        "data": {"task_id": task_id}
                    }))
                    
                elif event_type == "cancel_request":
                    # Cancel a specific task
                    task_id = event_data.get("task_id")
                    if session_id and session_id in active_sessions:
                        session = active_sessions[session_id]
                        if task_id in session.active_tasks:
                            session.active_tasks[task_id].cancel()
                            session.remove_task(task_id)
                            await websocket.send(json.dumps({
                                "event": "request_cancelled",
                                "data": {"task_id": task_id}
                            }))
                        else:
                            await websocket.send(json.dumps({
                                "event": "error",
                                "data": {"message": f"Task {task_id} not found"}
                            }))
                    else:
                        await websocket.send(json.dumps({
                            "event": "error",
                            "data": {"message": "Not logged in or session expired"}
                        }))
                        
                elif event_type == "logout":
                    # Handle logout request
                    if session_id and session_id in active_sessions:
                        # Cancel all tasks
                        session = active_sessions[session_id]
                        for task_id, task in list(session.active_tasks.items()):
                            task.cancel()
                        # Remove session
                        del active_sessions[session_id]
                        session_id = None
                        await websocket.send(json.dumps({
                            "event": "logout_response",
                            "data": {"status": "success"}
                        }))
                    else:
                        await websocket.send(json.dumps({
                            "event": "error",
                            "data": {"message": "Not logged in or session expired"}
                        }))
                        
                else:
                    # Handle unknown event type
                    await websocket.send(json.dumps({
                        "event": "error",
                        "data": {"message": f"Unknown event type: {event_type}"}
                    }))
                    
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received from client {client_id}")
                await websocket.send(json.dumps({
                    "event": "error",
                    "data": {"message": "Invalid JSON format"}
                }))
                
    except asyncio.CancelledError:
        logger.info(f"Connection with client {client_id} was cancelled")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {str(e)}")
    finally:
        # Clean up on disconnect
        connected_clients.remove(websocket)
        if session_id and session_id in active_sessions:
            # Cancel all tasks
            session = active_sessions[session_id]
            for task_id, task in list(session.active_tasks.items()):
                if not task.done():
                    task.cancel()
            # Remove session
            del active_sessions[session_id]
        logger.info(f"Client {client_id} disconnected. Remaining clients: {len(connected_clients)}")

async def get_agent(tools: McpToolSpec):
    tools = await tools.to_tool_list_async()
    agent = FunctionAgent(
        name="Agent",
        description="An agent that can work with Google Sheets.",
        tools=tools,
        llm=llm,
        system_prompt=SYSTEM_PROMPT,
    )
    return agent

async def handle_login(websocket, client_id: str, data: Dict[str, Any]) -> str:
    """Handle login request and create agent instance"""
    # In a real application, you would validate credentials here
    # For this example, we'll create a new agent session for each login
    
    # Generate a unique session ID
    session_id = str(uuid.uuid4())
    
    try:
        # Create agent
        agent = await get_agent(mcp_tools)
        
        # Create context
        context = Context(agent)
        
        # Store the session
        active_sessions[session_id] = AgentSession(session_id, agent, context)
        
        logger.info(f"Created new agent session {session_id} for client {client_id}")
        return session_id
        
    except Exception as e:
        logger.error(f"Error creating agent session: {str(e)}")
        await websocket.send(json.dumps({
            "event": "error",
            "data": {"message": f"Failed to create agent session: {str(e)}"}
        }))
        # Return a dummy session ID - client will receive error anyway
        return str(uuid.uuid4())

async def process_agent_request(
    websocket,
    client_id: str,
    session_id: str,
    task_id: str,
    message_content: str
):
    """Process an agent request in a separate task"""
    try:
        if session_id not in active_sessions:
            await websocket.send(json.dumps({
                "event": "error",
                "data": {
                    "task_id": task_id,
                    "message": "Session expired"
                }
            }))
            return
            
        session = active_sessions[session_id]
        agent = session.agent
        context = session.context
        
        # Create custom event handler to stream events to the client
        handler = agent.run(message_content, ctx=context)
        
        # Stream events to the client
        async for event in handler.stream_events():
            # Convert event to JSON-serializable format
            event_data = {"task_id": task_id}
            
            if isinstance(event, ToolCall):
                event_type = "tool_call"
                event_data.update({
                    "tool_name": event.tool_name,
                    "tool_kwargs": event.tool_kwargs
                })
            elif isinstance(event, ToolCallResult):
                event_type = "tool_result"
                # Convert tool output to string if possible
                try:
                    tool_output = str(event.tool_output)
                except:
                    tool_output = "Non-serializable tool output"
                event_data.update({
                    "tool_name": event.tool_name,
                    "tool_output": tool_output
                })
            elif isinstance(event, AgentOutput):
                event_type = "agent_output"
                event_data.update({
                    "output": event.raw
                })
            else:
                # Skip unknown event types
                continue
                
            # Send event to client
            await websocket.send(json.dumps({
                "event": event_type,
                "data": event_data
            }))
            
        # Get final response
        response = await handler
        
        # Send final response to client
        await websocket.send(json.dumps({
            "event": "agent_response",
            "data": {
                "task_id": task_id,
                "response": str(response)
            }
        }))
        
    except asyncio.CancelledError:
        # Task was cancelled
        logger.info(f"Task {task_id} cancelled for client {client_id}")
        await websocket.send(json.dumps({
            "event": "task_cancelled",
            "data": {"task_id": task_id}
        }))
    except Exception as e:
        # Handle any errors
        logger.error(f"Error processing request {task_id} for client {client_id}: {str(e)}")
        await websocket.send(json.dumps({
            "event": "error",
            "data": {
                "task_id": task_id,
                "message": f"Error processing request: {str(e)}"
            }
        }))
    finally:
        # Remove task from active tasks
        if session_id in active_sessions:
            active_sessions[session_id].remove_task(task_id)

async def start_server():
    """Start the WebSocket server"""
    async with serve(handle_client, WS_HOST, WS_PORT):
        logger.info(f"WebSocket server started on {WS_HOST}:{WS_PORT}")
        await asyncio.Future()  # Run forever

def run_server():
    """Entry point to run the WebSocket server"""
    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        logger.info("Server shutdown initiated by user")
    except Exception as e:
        logger.error(f"Server error: {str(e)}")

if __name__ == "__main__":
    run_server()
