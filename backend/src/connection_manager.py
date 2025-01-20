from typing import Dict
import websockets
import json
from logging_utils import AdvancedLogger

class ConnectionManager:
    """
    Manages WebSocket connections for both mobile clients and frontend applications.
    
    This class handles the lifecycle of WebSocket connections, including:
        - Adding and removing connections
        - Message sending
        - Connection lookups
        - Separate handling for mobile and frontend connections
    
    The manager maintains two distinct connection pools:
        - Mobile connections: Indexed by user code
        - Frontend connections: Indexed by WebSocket object
    """

    def __init__(self):
        """
        Initialize the connection manager.
        
        Sets up separate dictionaries for mobile and frontend connections
        and initializes the logger.
        """
        # Dictionary to store mobile connections, keyed by user code
        self.connected_mobile: Dict[str, websockets.WebSocketServerProtocol] = {}
        # Dictionary to store frontend connections, keyed by WebSocket object
        self.connected_frontend: Dict[websockets.WebSocketServerProtocol, int] = {}
        # Initialize logger for connection operations
        self.logger = AdvancedLogger.get_logger()

    async def send_message(self, websocket, message):
        """
        Send a JSON message to a specific WebSocket connection.
        
        Args:
            websocket: WebSocket connection to send the message to
            message: Message content to be JSON-encoded and sent
            
        Logs any errors that occur during message sending but doesn't raise them.
        """
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            self.logger.exception("Failed to send message to websocket")

    def add_mobile_connection(self, code, websocket):
        """
        Register a new mobile client connection.
        
        Args:
            code (str): User's unique identifier
            websocket: WebSocket connection for the mobile client
        """
        self.connected_mobile[code] = websocket

    def remove_mobile_connection(self, code):
        """
        Remove a mobile client connection.
        
        Args:
            code (str): User's unique identifier to remove
            
        Safely removes the connection if it exists.
        """
        if code in self.connected_mobile:
            del self.connected_mobile[code]

    def add_frontend_connection(self, websocket):
        """
        Register a new frontend application connection.
        
        Args:
            websocket: WebSocket connection for the frontend
            
        Assigns an incremental index to each frontend connection.
        """
        self.connected_frontend[websocket] = len(self.connected_frontend)

    def remove_frontend_connection(self, websocket):
        """
        Remove a frontend application connection.
        
        Args:
            websocket: WebSocket connection to remove
            
        Safely removes the connection if it exists.
        """
        if websocket in self.connected_frontend:
            del self.connected_frontend[websocket]
    
    def get_mobile_code(self):
        """
        Get all connected mobile user codes.
        
        Returns:
            set: Set of user codes for all connected mobile clients
        """
        return self.connected_mobile.keys()

    def get_mobile_connections(self):
        """
        Get all active mobile WebSocket connections.
        
        Returns:
            list: List of WebSocket connections for mobile clients
        """
        return self.connected_mobile.values()
    
    def get_mobile_connection(self, code):
        """
        Get the WebSocket connection for a specific mobile user.
        
        Args:
            code (str): User's unique identifier
            
        Returns:
            WebSocketServerProtocol: WebSocket connection for the user if found, None otherwise
        """
        return self.connected_mobile.get(code)
    
    def get_frontend_connections(self):
        """
        Get all active frontend WebSocket connections.
        
        Returns:
            set: Set of WebSocket connections for frontend applications
        """
        return self.connected_frontend.keys()