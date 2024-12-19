import asyncio
from websocket_server import WebSocketServer

# main.py
if __name__ == "__main__":
    server = WebSocketServer()
    asyncio.run(server.run("0.0.0.0", 8080))