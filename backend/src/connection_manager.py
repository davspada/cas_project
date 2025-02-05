import websockets
import json

from logging import Logger
from typing import Dict, Set, List, Optional

from logging_utils import AdvancedLogger

class ConnectionManager:
    """
    Manages WebSocket connections for both mobile clients and frontend applications.
    
    This class handles the lifecycle of WebSocket connections, including:
    1. Adding and removing connections
    2. Message sending
    3. Connection lookups
    4. Separate handling for mobile and frontend connections
    
    The manager maintains two distinct connection pools:
    - Mobile connections: Indexed by user code
    - Frontend connections: Indexed by WebSocket object
    """

    def __init__(self) -> None:
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
        self.logger: Logger = AdvancedLogger.get_logger()

    async def send_message(self, websocket: websockets.WebSocketServerProtocol, message: str) -> None:
        """
        Send a JSON message to a specific WebSocket connection.
        
        Args:
        - websocket (WebSocketServerProtocol): WebSocket connection to send the message to
        - message (str): Message content to be JSON-encoded and sent
            
        Logs any errors that occur during message sending but doesn't raise them.
        """
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            self.logger.exception("Failed to send message to websocket")

    def add_mobile_connection(self, code: str, websocket: websockets.WebSocketServerProtocol) -> None:
        """
        Register a new mobile client connection.
        
        Args:
        - code (str): User's unique identifier
        - websocket (WebSocketServerProtocol): WebSocket connection for the mobile client
        """
        self.connected_mobile[code] = websocket

    def remove_mobile_connection(self, code: str) -> None:
        """
        Remove a mobile client connection.
        
        Args:
        - code (str): User's unique identifier to remove
            
        Safely removes the connection if it exists.
        """
        if code in self.connected_mobile:
            del self.connected_mobile[code]

    def add_frontend_connection(self, websocket: websockets.WebSocketServerProtocol) -> None:
        """
        Register a new frontend application connection.
        
        Args:
        - websocket (WebSocketServerProtocol): WebSocket connection for the frontend
            
        Assigns an incremental index to each frontend connection.
        """
        self.connected_frontend[websocket] = len(self.connected_frontend)

    def remove_frontend_connection(self, websocket: websockets.WebSocketServerProtocol) -> None:
        """
        Remove a frontend application connection.
        
        Args:
        - websocket (WebSocketServerProtocol): WebSocket connection to remove
            
        Safely removes the connection if it exists.
        """
        if websocket in self.connected_frontend:
            del self.connected_frontend[websocket]

    def get_mobile_code(self) -> Set[str]:
        """
        Get all connected mobile user codes.
        
        Returns:
        - Set[str]: Set of user codes for all connected mobile clients
        """
        return set(self.connected_mobile.keys())

    def get_mobile_connections(self) -> List[websockets.WebSocketServerProtocol]:
        """
        Get all active mobile WebSocket connections.
        
        Returns:
        - List[WebSocketServerProtocol]: List of WebSocket connections for mobile clients
        """
        return list(self.connected_mobile.values())

    def get_mobile_connection(self, code: str) -> Optional[websockets.WebSocketServerProtocol]:
        """
        Get the WebSocket connection for a specific mobile user.
        
        Args:
        - code (str): User's unique identifier
            
        Returns:
        - Optional[WebSocketServerProtocol]: WebSocket connection for the user if found, None otherwise
        """
        return self.connected_mobile.get(code)

    def get_frontend_connections(self) -> Set[websockets.WebSocketServerProtocol]:
        """
        Get all active frontend WebSocket connections.
        
        Returns:
        - Set[WebSocketServerProtocol]: Set of WebSocket connections for frontend applications
        """
        return set(self.connected_frontend.keys())
