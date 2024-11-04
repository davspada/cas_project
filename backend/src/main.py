import asyncio
import asyncpg
import json
import logging
import kafka
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

KAFKA_HOST = 'localhost'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketServer:
    def __init__(self):
        self.db_pool = None
        self.connected_mobile: Dict[str, websockets.WebSocketServerProtocol] = {}

    async def connect_to_db(self):
        self.db_pool = await asyncpg.create_pool(**DB_CONFIG)

    async def subscribe_to_kafka_topic(self):
        self.kafka_consumer = kafka.KafkaConsumer(
            'users-in-danger', 'user-updates', 'alert-updates',
            bootstrap_servers=f'{KAFKA_HOST}:9092',
            auto_offset_reset='latest',
            value_deserializer=lambda v: json.loads(v.decode('utf-8'))
        )

        self.kafka_producer = kafka.KafkaProducer(
            bootstrap_servers=f'{KAFKA_HOST}:9092',
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )

    async def send_message (self, websocket, message):
        await websocket.send(json.dumps({message}))

    async def update_location(self, code, position):
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("UPDATE USERS SET position = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE code = $3",
                                   position['lon'], position['lat'], code)
            await self.send_message(self.connected_mobile[code], "Position updated")
            await logger.info(f"User {code} updated position")
        except Exception as e:
            await self.send_message(self.connected_mobile[code], f"Error updating position: {str(e)}")
            await logger.error(f"Error updating position for user {code}: {str(e)}")

    async def update_transport_method(self, code, transport_method):
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("UPDATE USERS SET transport_method = $1 WHERE code = $2", transport_method, code)
            await self.send_message(self.connected_mobile[code], "Transport method updated")
            await logger.info(f"User {code} updated transport method")
        except Exception as e:
            await self.send_message(self.connected_mobile[code], f"Error updating transport method: {str(e)}")
            await logger.error(f"Error updating transport method for user {code}: {str(e)}")

    async def handle_mobile(self, websocket, path):
        try:
            # Step 1: Receive unique code from client
            message = await websocket.recv()
            data = json.loads(message)
            code = data.get('code')
            mobile_token = data.get('token')

            if not code:
                await self.send_message(websocket, "Error, no code provided")
                return

            # Step 2: Check if code exists in database
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT token FROM USERS WHERE code = $1", code)
                
                if row:
                    db_token = row['token']
                    if db_token != mobile_token:
                        await self.send_message(websocket, "Error, invalid token")
                        await logger.error(f"Invalid token for user {code}")
                        return
                else:
                    # Generate new token and add to database
                    new_token = secrets.token_hex(16)
                    await conn.execute("INSERT INTO USERS (code, token, connected) VALUES ($1, $2, false)", code, new_token)
                    await websocket.send(json.dumps({"token": new_token}))

                # Step 3: Update connected status
                await conn.execute("UPDATE USERS SET connected = true WHERE code = $1", code)
                await self.send_message(websocket, "Connected")
                await logger.info(f"User {code} connected")

            self.connected_mobile[code] = websocket

            # Step 4: Wait for updates
            async for message in websocket:
                data = json.loads(message)
                if 'position' in data:
                    await self.update_location(code, data['position'])
                elif 'transport_method' in data:
                    await self.update_transport_method(code, data['transport_method'])

                # TODO: Check if transport method is usefull
                self.kafka_producer.send('user-updates', key=code.encode('utf-8'), value=data)

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            # Step 6: Handle disconnection
            if code in self.connected_mobile:
                del self.connected_mobile[code]
                async with self.db_pool.acquire() as conn:
                    await conn.execute("UPDATE USERS SET connected = false WHERE code = $1", code)
                await self.send_message(websocket, "Disconnected")
                await logger.info(f"User {code} disconnected")

    # TODO
    async def check_users_in_danger(self):
        pass

    async def handle_frontend(self, websocket, path):
        # Step 1: Send actual state from db to frontend
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT code, position, transport_method FROM USERS WHERE connected = true AND position IS NOT NULL AND transport_method IS NOT NULL")
            rows += await conn.fetch("SELECT geofence, time_start, description FROM ALERTS WHERE time_end IS NULL")
            for row in rows:
                await websocket.send(json.dumps(row))

        # Step 3: Listen for updates from Kafka
        async for message in self.kafka_consumer:
            await websocket.send(json.dumps(message.value))

        # Step 2: Await for frontend updates
        async for message in websocket:
            data = json.loads(message)
            if 'time_end' in data:
                async with self.db_pool.acquire() as conn:
                    await conn.execute("UPDATE ALERTS SET time_end = $1 WHERE geofence = $2", data['time_end'], data['geofence'])
                await self.kafka_producer.send('alert-updates', value=data)

            elif 'geofence' in data:
                # Update the alerts table
                async with self.db_pool.acquire() as conn:
                    await conn.execute("INSERT INTO ALERTS (geofence, time_start, description) VALUES ($1, $2, $3)",
                                       data['geofence'], data['time_start'], data['description'])
                
                #TODO: Create function to check users is in danger
                
                await self.kafka_producer.send('alert-updates', value=data)

    # TODO
    async def kafka_listener(self):
        pass

    async def run(self, host, port):
        await self.connect_to_db()
        await self.subscribe_to_kafka_topic()

        asyncio.create_task(self.kafka_listener())

        server_mobile = await websockets.serve(self.handle_mobile, host, port)
        server_frontend = await websockets.serve(self.handle_frontend, host, port + 1)
        
        print(f"WebSocket mobile server is running on {host}:{port}")
        print(f"WebSocket frontend server is running on {host}:{port + 1}")

        await server_mobile.wait_closed()
        await server_frontend.wait_closed()

if __name__ == "__main__":
    server = WebSocketServer()
    asyncio.run(server.run("127.0.0.1", 8080))