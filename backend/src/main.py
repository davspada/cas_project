import asyncio
import asyncpg
from datetime import datetime
import json
import logging
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import secrets
import websockets
from typing import Dict

# Database connection details
DB_CONFIG = {
    "host": "localhost",
    "database": "mydb",
    "user": "postgis",
    "password": "password"
}

KAFKA_HOST = 'localhost:9092'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketServer:
    def __init__(self):
        self.name = "WebSocketServer"
        self.db_pool = None
        self.connected_mobile: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.connected_frontend: Dict[websockets.WebSocketServerProtocol, int] = {}
        self.kafka_consumer = None
        self.kafka_producer = None

    async def connect_to_db(self):
        try:
            logger.info("Connecting to database...")
            self.db_pool = await asyncpg.create_pool(**DB_CONFIG)
            logger.info("Connected to database")
        except Exception as e:
            logger.exception(f"Failed to connect to the database")
            raise

    async def start_kafka(self):
        try:
            logger.info("Starting Kafka consumer and producer...")
            self.kafka_consumer = AIOKafkaConsumer(
                'alert-updates', 'user-updates', 'users-in-danger',
                bootstrap_servers=f'{KAFKA_HOST}',
                auto_offset_reset='latest',
                value_deserializer=lambda v: json.loads(v.decode('utf-8'))
            )
            await self.kafka_consumer.start()

            self.kafka_producer = AIOKafkaProducer(
                bootstrap_servers=f'{KAFKA_HOST}',
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            await self.kafka_producer.start()

            logger.info("Kafka consumer and producer started successfully")
        except Exception as e:
            logger.exception(f"Failed to start Kafka services")
            raise

    async def stop_kafka(self):
        if self.kafka_consumer:
            await self.kafka_consumer.stop()
        if self.kafka_producer:
            await self.kafka_producer.stop()
        logger.info("Kafka consumer and producer stopped")

    async def send_message(self, websocket, message):
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.exception(f"Failed to send message to websocket")

    async def update_location(self, code, position):
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE USERS SET position = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE code = $3",
                    position['lon'], position['lat'], code
                )
            #await self.send_message(self.connected_mobile[code], "Position updated")
            logger.info(f"User {code} updated position")
        except Exception as e:
            logger.exception(f"Error updating position for user {code}")

    async def update_transport_method(self, code, transport_method):
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("UPDATE USERS SET transport_method = $1 WHERE code = $2", transport_method, code)
            # await self.send_message(self.connected_mobile[code], "Transport method updated")
            logger.info(f"User {code} updated transport method")
        except Exception as e:
            logger.exception(f"Error updating transport method for user {code}")

    async def handle_mobile(self, websocket, path):
        code = None
        try:
            message = await websocket.recv()
            data = json.loads(message)
            code = data.get('code')
            mobile_token = data.get('token')

            if not code:
                # await self.send_message(websocket, "Error, no code provided")
                return

            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT token FROM USERS WHERE code = $1", code)

                if row and row['token'] != mobile_token:
                    # await self.send_message(websocket, "Error, invalid token")
                    logger.warning(f"Invalid token for user {code}")
                    return
                elif not row:
                    new_token = secrets.token_hex(16)
                    await conn.execute("INSERT INTO USERS (code, token, connected) VALUES ($1, $2, false)", code, new_token)
                    await websocket.send(json.dumps({"token": new_token}))

                await conn.execute("UPDATE USERS SET connected = true WHERE code = $1", code)
                # await self.send_message(websocket, "Connected")
                logger.info(f"User {code} connected")

            self.connected_mobile[code] = websocket

            async for message in websocket:
                data = json.loads(message)
                if 'position' in data:
                    await self.update_location(code, data['position'])
                elif 'transport_method' in data:
                    await self.update_transport_method(code, data['transport_method'])

                await self.kafka_producer.send('user-updates', key=code.encode('utf-8'), value=data)

        except Exception as e:
            logger.exception(f"Error handling mobile connection for user {code}")
        finally:
            if code in self.connected_mobile:
                del self.connected_mobile[code]
                async with self.db_pool.acquire() as conn:
                    await conn.execute("UPDATE USERS SET connected = false WHERE code = $1", code)
                logger.info(f"User {code} disconnected")

    async def handle_frontend(self, websocket, path):
        try:
            logger.info(f"Frontend {len(self.connected_frontend)} connected, sending all data...")

            async with self.db_pool.acquire() as conn:
                users_query = """
                    SELECT code, ST_AsGeoJSON("position"), transport_method 
                    FROM USERS 
                    WHERE connected = true 
                    AND position IS NOT NULL 
                    AND transport_method IS NOT NULL
                """
                users = await conn.fetch(users_query)

                alerts_query = """
                    SELECT ST_AsGeoJSON("geofence"), time_start, description 
                    FROM ALERTS 
                    WHERE time_end IS NULL
                """
                alerts = await conn.fetch(alerts_query)

                def serialize_data(item):
                    if isinstance(item, datetime):
                        return item.isoformat()
                    return item

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

                await websocket.send(json.dumps(response))

            self.connected_frontend[websocket] = len(self.connected_frontend)
            logger.info(f"All data sent to frontend {self.connected_frontend[websocket]}, listening for updates...")

            async for message in self.kafka_consumer:
                if message.topic != 'users-in-danger' and websocket in self.connected_frontend:
                    await websocket.send(json.dumps(message.value))

            async for message in websocket:
                data = json.loads(message)
                if 'time_end' in data:
                    async with self.db_pool.acquire() as conn:
                        await conn.execute("UPDATE ALERTS SET time_end = $1 WHERE geofence = $2", data['time_end'], data['geofence'])
                    await self.kafka_producer.send('alert-updates', value=data)
                elif 'geofence' in data:
                    async with self.db_pool.acquire() as conn:
                        await conn.execute("INSERT INTO ALERTS (geofence, time_start, description) VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), $2, $3)", data['geofence'], data['time_start'], data['description'])
                    await self.kafka_producer.send('alert-updates', value=data)
        except Exception as e:
            logger.exception(f"Error handling frontend connection")
        finally:
            logger.info("Frontend disconnected")

    async def kafka_listener(self):
        try:
            async for message in self.kafka_consumer:
                if message.topic == 'users-in-danger' and message.key in self.connected_mobile:
                    await self.send_message(self.connected_mobile[message.key], message.value)
        except Exception as e:
            logger.exception(f"Error in Kafka listener")

    async def run(self, host, port):
        try:
            await self.connect_to_db()
            await self.start_kafka()

            kafka_task = asyncio.create_task(self.kafka_listener())

            server_mobile = await websockets.serve(self.handle_mobile, host, port)
            server_frontend = await websockets.serve(self.handle_frontend, host, port + 1)

            await asyncio.gather(server_mobile.wait_closed(), server_frontend.wait_closed(), kafka_task)
        except Exception as e:
            logger.exception(f"Error running the WebSocket server")
        finally:
            await self.stop_kafka()
            if self.db_pool:
                await self.db_pool.close()

if __name__ == "__main__":
    server = WebSocketServer()
    asyncio.run(server.run("127.0.0.1", 8080))
