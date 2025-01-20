import asyncio
import json
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from logging_utils import AdvancedLogger

class KafkaManager:
    """
    Manages Kafka message broker interactions for real-time communication.
    
    This class handles the initialization, management, and cleanup of Kafka consumers
    and producers. It processes messages from multiple topics and distributes them
    to appropriate WebSocket connections based on message type.
    
    Topics handled:
        - alert-updates: Alert creation and modifications
        - user-updates: User location and transport method changes
        - users-in-danger: Notifications for users in danger zones
    """

    def __init__(self, bootstrap_servers, connection_manager):
        """
        Initialize the Kafka manager with server configuration and connection management.
        
        Args:
            bootstrap_servers (str): Kafka broker addresses
            connection_manager: Instance of ConnectionManager for WebSocket communications
        """
        # Store Kafka broker addresses for connection
        self.bootstrap_servers = bootstrap_servers
        # Store reference to WebSocket connection manager
        self.connection_manager = connection_manager
        # Initialize logger for Kafka operations
        self.logger = AdvancedLogger.get_logger()
        # Initialize consumer and producer as None until start() is called
        self.consumer = None
        self.producer = None

    async def start(self):
        """
        Start Kafka consumer and producer services.
        
        Initializes and starts both consumer and producer connections to Kafka.
        Sets up message deserializer for incoming messages and serializer for outgoing messages.
        Starts the background listening task for processing incoming messages.
        
        Raises:
            Exception: If Kafka services fail to start
        """
        try:
            self.logger.info("Starting Kafka consumer and producer...")
            
            # Initialize consumer with topic subscriptions and JSON deserializer
            self.consumer = AIOKafkaConsumer(
                'alert-updates', 'user-updates', 'users-in-danger',
                bootstrap_servers=self.bootstrap_servers,
                auto_offset_reset='latest',  # Only process new messages
                value_deserializer=lambda v: json.loads(v.decode('utf-8'))
            )
            await self.consumer.start()

            # Initialize producer with JSON serializer
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            await self.producer.start()
            
            self.logger.info("Kafka consumer and producer started successfully")
            
            # Start background task for message processing
            asyncio.create_task(self.listen())

        except Exception as e:
            self.logger.exception("Failed to manage Kafka services")
            raise

    async def listen(self):
        """
        Listen for and process incoming Kafka messages.
        
        Continuously monitors Kafka topics and routes messages to appropriate
        WebSocket connections based on the message topic and content.
        
        Message routing:
            - alert-updates: Sent to all frontend and mobile connections
            - users-in-danger: Sent to specific mobile user based on user code
            - user-updates: Sent to all frontend connections
        """
        async for message in self.consumer:
            self.logger.info(f"Received message from topic {message.topic}")
            
            # Use pattern matching to handle different message topics
            match message.topic:
                case 'alert-updates':
                    # Broadcast alert updates to all connections
                    for frontend in self.connection_manager.get_frontend_connections():
                        await self.connection_manager.send_message(frontend, message.value)
                    
                    for mobile in self.connection_manager.get_mobile_connections():
                        await self.connection_manager.send_message(mobile, message.value)
                
                case 'users-in-danger':
                    # Parse the message to extract user code and content
                    parts = message.value.split(", message: ")

                    # Find the specific mobile user and send them the danger alert
                    for mobile in self.connection_manager.get_mobile_code():
                        if mobile == parts[0].split("code: ")[1].strip():
                            await self.connection_manager.send_message(
                                self.connection_manager.get_mobile_connection(mobile), 
                                parts[1].strip()
                            )
                            break
                    
                case 'user-updates':
                    # Broadcast user updates to all frontend connections
                    for frontend in self.connection_manager.get_frontend_connections():
                        self.connection_manager.send_message(frontend, message.value)
                
                case _:
                    # Log unknown topics for debugging
                    self.logger.warning(f"Received message from unknown topic: {message.topic}")

    async def stop(self):
        """
        Stop Kafka consumer and producer services.
        
        Gracefully shuts down both consumer and producer connections,
        ensuring proper cleanup of Kafka resources.
        """
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()
        self.logger.info("Kafka consumer and producer stopped")

    async def send_message(self, topic, message):
        """
        Send a message to a specific Kafka topic.
        
        Args:
            topic (str): The Kafka topic to send the message to
            message: The message content to be serialized and sent
        """
        await self.producer.send_and_wait(topic, json.dumps(message), partition=0)