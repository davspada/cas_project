import asyncio
import asyncpg
import json
import secrets
import websockets

from logging import Logger
from typing import Any, Optional, List, Dict

from alert_manager import AlertManager
from config import DB_CONFIG, KAFKA_HOST
from connection_manager import ConnectionManager
from database_manager import DatabaseManager
from kafka_manager import KafkaManager
from logging_utils import AdvancedLogger

class WebSocketServer:
    """
    A WebSocket server that handles real-time communication between mobile clients and frontend applications.
    
    This server manages two types of WebSocket connections:
    1. Mobile connections: For users connecting from mobile devices, handling location updates and transport methods
    2. Frontend connections: For administrative interfaces, providing real-time updates and alert management
    
    The server integrates with a database for persistence and Kafka for message broadcasting.
    """

    def __init__(self) -> None:
        """
        Initialize the WebSocket server with necessary dependencies.
        
        Sets up logging, connection management, database connection, and Kafka integration.
        """
        # Set up logging for server operations
        self.logger: Logger = AdvancedLogger.get_logger()
        # Initialize connection manager to track active WebSocket connections
        self.connections: ConnectionManager = ConnectionManager()
        # Set up database connection with configured parameters
        self.db: DatabaseManager = DatabaseManager(DB_CONFIG)
        # Initialize Kafka manager for message broadcasting
        self.kafka: KafkaManager = KafkaManager(KAFKA_HOST, self.connections)
        # Initialize alert manager for alert creation and management
        self.alerts: AlertManager = AlertManager(self.db, self.kafka, self.connections)

    async def handle_mobile(self, websocket: websockets.WebSocketServerProtocol, path: str) -> None:
        """
        Handle WebSocket connections from mobile clients.
        
        This method manages the lifecycle of mobile client connections, including:
        1. User authentication using codes and tokens
        2. Location and transport method updates
        3. Connection state management
        
        Args:
        - websocket (WebSocketServerProtocol): The WebSocket connection object
        - path (str): The connection path (unused but required by websockets library)
        """
        try:
            # Get initial connection message containing auth details
            code: Optional[str] = None
            message: str = await websocket.recv()
            data: Dict[str, Any] = json.loads(message)
            code = data.get('code')
            mobile_token: Optional[str] = data.get('token')

            # Validate user code and token
            if not code:
                self.logger.warning("Invalid code in mobile connection")
                await self.connections.send_message(websocket, {"error": "Invalid code"})
                return

            # Check if user exists and validate token
            row: Optional[asyncpg.Record] = await self.db.get_user_token(code)

            # If user exists but token doesn't match, reject connection
            if row and row['token'] != mobile_token:
                self.logger.warning(f"Invalid token for user {code}")
                await self.connections.send_message(websocket, {"error": "Invalid token"})
                return

            # If new user, create account and generate token
            elif not row:
                new_token: str = secrets.token_hex(16)
                await self.db.create_user(code, new_token)
                await self.connections.send_message(websocket, {"token": new_token})

            # Update user's connection status and store WebSocket connection
            await self.db.update_user_connection(code, True)
            self.connections.add_mobile_connection(code, websocket)
            self.logger.info(f"User {code} connected")

            # Main message processing loop
            async for message in websocket:
                data: Dict[str, Any] = json.loads(message)
                # Handle location updates
                if 'position' in data:
                    await self.db.update_user_location(code, data['position'])
                    await self.alerts.process_user_update(code, data['position'])
                # Handle transport method updates
                if 'transport_method' in data:
                    await self.db.update_transport_method(code, data['transport_method'])

                # Broadcast updates to Kafka
                await self.kafka.send_message('user-updates', data)

        except Exception as e:
            self.logger.exception(f"Error handling mobile connection for user {code}")
        finally:
            # Clean up on disconnection
            if code:
                self.connections.remove_mobile_connection(code)
                await self.db.update_user_connection(code, False)
                self.logger.info(f"User {code} disconnected")

    async def handle_frontend(self, websocket: websockets.WebSocketServerProtocol, path: str) -> None:
        """
        Handle WebSocket connections from frontend applications.
        
        This method manages the frontend interface connections, including:
        1. Initial data synchronization
        2. Real-time updates via Kafka
        3. Alert creation and management
        
        Args:
        - websocket (WebSocketServerProtocol): The WebSocket connection object
        - path (str): The connection path (unused but required by websockets library)
        """
        try:
            self.logger.info("Frontend connected, sending all data...")

            # Fetch initial state data
            users: List[asyncpg.Record] = await self.db.get_connected_users()
            alerts: List[asyncpg.Record] = await self.db.get_active_alerts()

            # Prepare initial state response
            response: Dict[str, Any] = {
                "users": [
                    {key: self.alerts.serialize_data(value) for key, value in dict(row).items()} 
                    for row in users
                ],
                "alerts": [
                    {key: self.alerts.serialize_data(value) for key, value in dict(row).items()} 
                    for row in alerts
                ],
            }

            # Send initial state data to frontend and set up connection
            await websocket.send(json.dumps(response))
            self.connections.add_frontend_connection(websocket)
            self.logger.info("All data sent to frontend, listening for updates...")

            # Main message processing loop
            async for message in websocket:
                await self.kafka.send_message('alert-updates', await self.alerts.sync_alert_cache(json.loads(message)))

        except Exception as e:
            self.logger.exception("Error handling frontend connection")
        finally:
            # Clean up on disconnection
            self.connections.remove_frontend_connection(websocket)
            self.logger.info("Frontend disconnected")

    async def run(self, host: str, port: int) -> None:
        """
        Start the WebSocket server and listen for incoming connections.
        
        Sets up two separate servers:
        1. Mobile server for user connections
        2. Frontend server for administrative interfaces
        
        Args:
        - host (str): The hostname to bind to
        - port (int): The port number for the mobile server
                      (frontend server will use port + 1)
        """
        try:
            self.logger.info("Starting WebSocket server...")

            # Initialize database and Kafka connections
            await self.db.connect()
            await self.kafka.start()
            await self.alerts.start()

            # Start listening for incoming messages
            asyncio.create_task(self.kafka.listen(self.alerts))

            self.logger.info("Starting mobile and frontend WebSocket servers...")

            # Start both WebSocket servers
            server_mobile: websockets.WebSocketServerProtocol = await websockets.serve(self.handle_mobile, host, port)
            server_frontend: websockets.WebSocketServerProtocol = await websockets.serve(self.handle_frontend, host, port + 1)

            self.logger.info(f"Mobile WebSocket server listening on ws:{host}:{port}")
            self.logger.info(f"Frontend WebSocket server listening on ws:{host}:{port + 1}")

            # Wait for both servers to close
            await asyncio.gather(
                server_mobile.wait_closed(),
                server_frontend.wait_closed()
            )
        except Exception as e:
            self.logger.exception("Error running the WebSocket server")
        finally:
            # Clean up on server shutdown
            await self.kafka.stop()
            await self.db.close()
