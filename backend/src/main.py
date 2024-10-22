import asyncio
import websockets
import asyncpg
import json
import secrets
from typing import Dict

# Database connection details
DB_CONFIG = {
    "host": "localhost",
    "database": "mydb",
    "user": "postgis",
    "password": "password"
}

class WebSocketServer:
    def __init__(self):
        self.db_pool = None
        self.connected_clients: Dict[str, websockets.WebSocketServerProtocol] = {}

    async def connect_to_db(self):
        self.db_pool = await asyncpg.create_pool(**DB_CONFIG)

    async def handle_client(self, websocket, path):
        try:
            # Step 1: Receive unique code from client
            message = await websocket.recv()
            data = json.loads(message)
            code = data.get('code')
            client_token = data.get('token')

            if not code:
                await self.send_error(websocket, "No code provided")
                return

            # Step 2: Check if code exists in database
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT token FROM USERS WHERE code = $1", code)
                
                if row:
                    db_token = row['token']
                    if db_token != client_token:
                        await self.send_error(websocket, "Invalid token")
                        return
                else:
                    # Generate new token and add to database
                    new_token = secrets.token_hex(16)
                    await conn.execute("INSERT INTO USERS (code, token, connected) VALUES ($1, $2, false)", code, new_token)
                    await websocket.send(json.dumps({"token": new_token}))

                # Step 3: Update connected status
                await conn.execute("UPDATE USERS SET connected = true WHERE code = $1", code)
                await self.notify_all(f"User {code} connected")

            self.connected_clients[code] = websocket

            # Step 4: Wait for updates
            async for message in websocket:
                data = json.loads(message)
                if 'position' in data:
                    await self.update_location(code, data['position'])
                elif 'transport_method' in data:
                    await self.update_transport_method(code, data['transport_method'])

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            # Step 6: Handle disconnection
            if code in self.connected_clients:
                del self.connected_clients[code]
                async with self.db_pool.acquire() as conn:
                    await conn.execute("UPDATE USERS SET connected = false WHERE code = $1", code)
                await self.notify_all(f"User {code} disconnected")

    async def update_location(self, code, position):
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("UPDATE USERS SET position = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE code = $3",
                                   position['lon'], position['lat'], code)
            await self.notify_all(f"User {code} updated position")
        except Exception as e:
            await self.send_error(self.connected_clients[code], f"Error updating position: {str(e)}")

    async def update_transport_method(self, code, transport_method):
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("UPDATE USERS SET transport_method = $1 WHERE code = $2", transport_method, code)
            await self.notify_all(f"User {code} updated transport method")
        except Exception as e:
            await self.send_error(self.connected_clients[code], f"Error updating transport method: {str(e)}")

    async def notify_all(self, message):
        for client in self.connected_clients.values():
            await client.send(json.dumps({"notification": message}))

    async def send_error(self, websocket, error_message):
        await websocket.send(json.dumps({"error": error_message}))

    async def run(self, host, port):
        await self.connect_to_db()
        server = await websockets.serve(self.handle_client, host, port)
        print(f"WebSocket server running on {host}:{port}")
        await server.wait_closed()

if __name__ == "__main__":
    server = WebSocketServer()
    asyncio.run(server.run("127.0.0.1", 8080))