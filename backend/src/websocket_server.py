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
    def __init__(self):
        self.connections = ConnectionManager()
        self.db = DatabaseManager(DB_CONFIG)
        self.kafka = KafkaManager(KAFKA_HOST, self.connections)
        self.logger = AdvancedLogger.get_logger()

    async def handle_mobile(self, websocket, path):
        code = None
        try:
            message = await websocket.recv()
            data = json.loads(message)
            code = data.get('code')
            mobile_token = data.get('token')

            if not code:
                self.logger.warning("Invalid code in mobile connection")
                self.connections.send_message(websocket, {"error": "Invalid code"})
                return

            row = await self.db.get_user_token(code)
            
            if row and row['token'] != mobile_token:
                self.logger.warning(f"Invalid token for user {code}")
                self.connections.send_message(websocket, {"error": "Invalid token"})
                return
            
            elif not row:
                new_token = secrets.token_hex(16)
                await self.db.create_user(code, new_token)
                self.connections.send_message(websocket, {"token": new_token})

            await self.db.update_user_connection(code, True)
            self.connections.add_mobile_connection(code, websocket)
            self.logger.info(f"User {code} connected")

            async for message in websocket:
                data = json.loads(message)
                if 'position' in data:
                    await self.db.update_user_location(code, data['position'])
                if 'transport_method' in data:
                    await self.db.update_transport_method(code, data['transport_method'])

                await self.kafka.send_message('user-updates', data)

        except Exception as e:
            self.logger.exception(f"Error handling mobile connection for user {code}")
        finally:
            if code:
                self.connections.remove_mobile_connection(code)
                await self.db.update_user_connection(code, False)
                self.logger.info(f"User {code} disconnected")

    async def handle_frontend(self, websocket, path):
        kafka_task = None
        try:
            async def kafka_handler():
                async for message in self.kafka.consumer:
                    if message.topic != 'users-in-danger' and websocket in self.connections.connected_frontend:
                        await self.connections.send_message(websocket, message.value)

            self.logger.info("Frontend connected, sending all data...")

            users = await self.db.get_connected_users()
            alerts = await self.db.get_active_alerts()

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
            self.connections.add_frontend_connection(websocket)
            self.logger.info("All data sent to frontend, listening for updates...")

            kafka_task = asyncio.create_task(kafka_handler())
            
            async for message in websocket:
                data = json.loads(message)
                if 'time_end' in data:
                    await self.db.update_alert(data['time_end'], data['geofence'])
                    await self.kafka.send_message('alert-updates', data)
                elif 'geofence' in data:
                    try:
                        formatted_date = datetime.fromisoformat(
                            data['time_start'].replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                    except ValueError:
                        self.logger.error(f"Invalid datetime format in time_start: {data['time_start']}")
                        continue

                    await self.db.create_alert(
                        data['geofence'], formatted_date, data['description']
                    )
                    await self.kafka.send_message('alert-updates', data)

                    await self.db.check_users_in_danger(data)
                        


        except Exception as e:
            self.logger.exception("Error handling frontend connection")
        finally:
            if kafka_task:
                kafka_task.cancel()
            self.connections.remove_frontend_connection(websocket)
            self.logger.info("Frontend disconnected")

    async def kafka_listener(self):
        try:
            async for message in self.kafka.consumer:
                if (message.topic == 'users-in-danger' and 
                    message.key in self.connections.connected_mobile):
                    await self.connections.send_message(
                        self.connections.connected_mobile[message.key],
                        message.value
                    )
        except Exception as e:
            self.logger.exception("Error in Kafka listener")

    async def run(self, host, port):
        try:
            await self.db.connect()
            await self.kafka.start()

            kafka_task = asyncio.create_task(self.kafka_listener())

            server_mobile = await websockets.serve(self.handle_mobile, host, port)
            server_frontend = await websockets.serve(self.handle_frontend, host, port + 1)

            self.logger.info(f"Mobile WebSocket server listening on ws:{host}:{port}")
            self.logger.info(f"Frontend WebSocket server listening on ws:{host}:{port + 1}")

            await asyncio.gather(
                server_mobile.wait_closed(),
                server_frontend.wait_closed(),
                kafka_task
            )
        except Exception as e:
            self.logger.exception("Error running the WebSocket server")
        finally:
            await self.kafka.stop()
            await self.db.close()