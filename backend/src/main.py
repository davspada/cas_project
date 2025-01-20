import asyncio
from websocket_server import WebSocketServer

"""
Main entry point for the WebSocket server.
Initializes the server and runs the event loop.
"""

if __name__ == "__main__":
    server: WebSocketServer = WebSocketServer()
    asyncio.run(server.run("0.0.0.0", 8080))