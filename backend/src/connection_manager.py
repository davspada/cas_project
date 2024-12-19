# connection_manager.py
from typing import Dict
import websockets
import json
from logging_utils import AdvancedLogger

class ConnectionManager:
    def __init__(self):
        self.connected_mobile: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.connected_frontend: Dict[websockets.WebSocketServerProtocol, int] = {}
        self.logger = AdvancedLogger.get_logger()

    async def send_message(self, websocket, message):
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            self.logger.exception("Failed to send message to websocket")

    def add_mobile_connection(self, code, websocket):
        self.connected_mobile[code] = websocket

    def remove_mobile_connection(self, code):
        if code in self.connected_mobile:
            del self.connected_mobile[code]

    def add_frontend_connection(self, websocket):
        self.connected_frontend[websocket] = len(self.connected_frontend)

    def remove_frontend_connection(self, websocket):
        if websocket in self.connected_frontend:
            del self.connected_frontend[websocket]