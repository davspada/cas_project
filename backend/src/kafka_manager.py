import json
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from logging_utils import AdvancedLogger

class KafkaManager:
    def __init__(self, bootstrap_servers, connection_manager, database_manager):
        self.bootstrap_servers = bootstrap_servers
        self.connection_manager = connection_manager
        self.database_manager = database_manager
        self.logger = AdvancedLogger.get_logger()
        self.consumer = None
        self.producer = None

    async def start(self):
        try:
            self.logger.info("Starting Kafka consumer and producer...")
            self.consumer = AIOKafkaConsumer(
                'alert-updates', 'user-updates', 'users-in-danger',
                bootstrap_servers=self.bootstrap_servers,
                auto_offset_reset='latest',
                value_deserializer=lambda v: json.loads(v.decode('utf-8'))
            )
            await self.consumer.start()

            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            await self.producer.start()
            
            self.logger.info("Kafka consumer and producer started successfully")
        except Exception as e:
            self.logger.exception("Failed to start Kafka services")
            raise
        
    async def listen(self):
        for message in self.consumer:
            match message.topic:
                case 'alert-updates':
                    for frontend in self.connection_manager.get_frontend_connections():
                        self.connection_manager.send_message(frontend, message.value)
                    
                    for mobile in self.connection_manager.get_mobile_connections():
                        self.connection_manager.send_message(mobile, message.value)
                
                case 'users-in-danger':
                    for mobile in self.connection_manager.get_mobile_connections():
                        if mobile in message.value['code']:
                            self.connection_manager.send_message(self.connection_manager.get_mobile_connection()[mobile], message.value)
                    
                case 'user-updates':
                    for frontend in self.connection_manager.get_frontend_connections():
                        self.connection_manager.send_message(frontend, message.value)
                
                case _:
                    self.logger.warning(f"Received message from unknown topic: {message.topic}")

    async def stop(self):
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()
        self.logger.info("Kafka consumer and producer stopped")

    async def send_message(self, topic, message):
        await self.producer.send_and_wait(topic, json.dumps(message), partition=0)