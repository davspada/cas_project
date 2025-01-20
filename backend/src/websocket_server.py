import asyncio
import json
import secrets
from datetime import datetime

import websockets
from config import DB_CONFIG, KAFKA_HOST
from database import DatabaseManager
from kafka_manager import KafkaManager
from connection_manager import ConnectionManager
from logging_utils import AdvancedLogger

class WebSocketServer:
    """
    A WebSocket server that handles real-time communication between mobile clients and frontend applications.
    
    This server manages two types of WebSocket connections:
    1. Mobile connections: For users connecting from mobile devices, handling location updates and transport methods
    2. Frontend connections: For administrative interfaces, providing real-time updates and alert management
    
    The server integrates with a database for persistence and Kafka for message broadcasting.
    """

    def __init__(self):
        """
        Initialize the WebSocket server with necessary dependencies.
        
        Sets up logging, connection management, database connection, and Kafka integration.
        """
        # Set up logging for server operations
        self.logger = AdvancedLogger.get_logger()
        # Initialize connection manager to track active WebSocket connections
        self.connections = ConnectionManager()
        # Set up database connection with configured parameters
        self.db = DatabaseManager(DB_CONFIG)
        # Initialize Kafka manager for message broadcasting
        self.kafka = KafkaManager(KAFKA_HOST, self.connections)

    async def handle_mobile(self, websocket, path):
        """
        Handle WebSocket connections from mobile clients.
        
        This method manages the lifecycle of mobile client connections, including:
        - User authentication using codes and tokens
        - Location and transport method updates
        - Connection state management
        
        Args:
            websocket: The WebSocket connection object
            path: The connection path (unused but required by websockets library)
        """
        code = None
        try:
            # Get initial connection message containing auth details
            message = await websocket.recv()
            data = json.loads(message)
            code = data.get('code')
            mobile_token = data.get('token')

            # Validate user code
            if not code:
                self.logger.warning("Invalid code in mobile connection")
                await self.connections.send_message(websocket, {"error": "Invalid code"})
                return

            # Check if user exists and validate token
            row = await self.db.get_user_token(code)
            
            # If user exists but token doesn't match, reject connection
            if row and row['token'] != mobile_token:
                self.logger.warning(f"Invalid token for user {code}")
                await self.connections.send_message(websocket, {"error": "Invalid token"})
                return
            
            # If new user, create account and generate token
            elif not row:
                new_token = secrets.token_hex(16)
                await self.db.create_user(code, new_token)
                await self.connections.send_message(websocket, {"token": new_token})

            # Update user's connection status and store WebSocket connection
            await self.db.update_user_connection(code, True)
            self.connections.add_mobile_connection(code, websocket)
            self.logger.info(f"User {code} connected")

            # Main message processing loop
            async for message in websocket:
                data = json.loads(message)
                # Handle location updates
                if 'position' in data:
                    await self.db.update_user_location(code, data['position'])
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

    async def handle_frontend(self, websocket, path):
        """
        Handle WebSocket connections from frontend applications.
        
        This method manages the frontend interface connections, including:
        - Initial data synchronization
        - Real-time updates via Kafka
        - Alert creation and management
        
        Args:
            websocket: The WebSocket connection object
            path: The connection path (unused but required by websockets library)
        """
        kafka_task = None
        try:
            # Define internal Kafka message handler
            async def kafka_handler():
                """
                Internal handler for Kafka messages.
                Forwards relevant messages to the frontend WebSocket connection.
                """
                async for message in self.kafka.consumer:
                    # Only forward non-danger messages to frontend
                    if message.topic != 'users-in-danger' and websocket in self.connections.connected_frontend:
                        await self.connections.send_message(websocket, message.value)

            self.logger.info("Frontend connected, sending all data...")

            # Fetch initial state data
            users = await self.db.get_connected_users()
            alerts = await self.db.get_active_alerts()

            def serialize_data(item):
                """Helper function to serialize datetime objects for JSON encoding."""
                if isinstance(item, datetime):
                    return item.isoformat()
                return item

            # Prepare initial state response
            response = {
                "users": [
                    {key: serialize_data(value) for key, value in dict(row).items()} 
                    for row in users
                ],
                "alerts": [
                    {key: serialize_data(value) for key, value in dict(row).items()} 
                    for row in alerts
                ],
            }

            # Send initial state and set up connection
            await websocket.send(json.dumps(response))
            self.connections.add_frontend_connection(websocket)
            self.logger.info("All data sent to frontend, listening for updates...")

            # Start Kafka consumer task
            kafka_task = asyncio.create_task(kafka_handler())
            
            # Main message processing loop
            async for message in websocket:
                data = json.loads(message)
                # Handle alert end time updates
                if 'time_end' in data:
                    await self.db.update_alert(data['time_end'], data['geofence'])
                    await self.kafka.send_message('alert-updates', data)
                # Handle new alert creation
                elif 'geofence' in data:
                    try:
                        # Convert ISO format datetime to native datetime
                        formatted_date = datetime.fromisoformat(
                            data['time_start'].replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                    except ValueError:
                        self.logger.error(f"Invalid datetime format in time_start: {data['time_start']}")
                        continue

                    # Create new alert
                    await self.db.create_alert(
                        data['geofence'], formatted_date, data['description']
                    )

                    # Broadcast alert updates and check for affected users
                    await self.kafka.send_message('alert-updates', data)
                    for message in await self.db.check_users_in_danger(data):
                        await self.kafka.send_message('users-in-danger', message)

        except Exception as e:
            self.logger.exception("Error handling frontend connection")
        finally:
            # Clean up on disconnection
            if kafka_task:
                kafka_task.cancel()
            self.connections.remove_frontend_connection(websocket)
            self.logger.info("Frontend disconnected")

    async def run(self, host, port):
        """
        Start the WebSocket server and listen for incoming connections.
        
        Sets up two separate servers:
        1. Mobile server for user connections
        2. Frontend server for administrative interfaces
        
        Args:
            host (str): The hostname to bind to
            port (int): The port number for the mobile server
                       (frontend server will use port + 1)
        """
        try:
            self.logger.info("Starting WebSocket server...")

            # Initialize database and Kafka connections
            await self.db.connect() 
            await self.kafka.start()

            self.logger.info("Starting mobile and frontend WebSocket servers...")

            # Start both WebSocket servers
            server_mobile = await websockets.serve(self.handle_mobile, host, port)
            server_frontend = await websockets.serve(self.handle_frontend, host, port + 1)

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
            # Clean up resources on shutdown
            await self.kafka.stop()
            await self.db.close()