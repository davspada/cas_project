import asyncio
import websockets
import json
import asyncpg
import logging
from dataclasses import dataclass
from typing import Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ClientData:
    code: str
    position: Tuple[float, float]  # latitude, longitude
    transport_mode: str

# Check if client is already connected
async def is_client_connected(db_pool, client_code):
    async with db_pool.acquire() as conn:
        query = "SELECT connected FROM users WHERE code = $1"
        result = await conn.fetchval(query, client_code)
        return result if result is not None else False

# Validate client data and update database values
async def validate_and_update_client(db_pool, data):
    async with db_pool.acquire() as conn:
        query = "SELECT EXISTS(SELECT 1 FROM users WHERE code = $1)"
        exists = await conn.fetchval(query, data.code)

        if exists:
            update = "UPDATE users SET position = ST_SetSRID(ST_MakePoint($2, $3), 4326), transport_mode = $4, connected = true WHERE code = $1"
            await conn.execute(update, data.code, data.position[0], data.position[1], data.transport_mode)
        else:
            insert = "INSERT INTO users (code, connected, position, transport_mode) VALUES ($1, true, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4)"
            await conn.execute(insert, data.code, data.position[0], data.position[1], data.transport_mode)
        return True

# Update client data in database
async def update_client_data(db_pool, data):
    async with db_pool.acquire() as conn:
        query = "SELECT EXISTS(SELECT 1 FROM users WHERE code = $1 AND connected = true)"
        exists = await conn.fetchval(query, data.code)

        if exists:
            update = "UPDATE users SET position = ST_SetSRID(ST_MakePoint($2, $3), 4326), transport_mode = $4 WHERE code = $1"
            await conn.execute(update, data.code, data.position[0], data.position[1], data.transport_mode)

# When client disconnects, set connected to false
async def disconnect_client(db_pool, code):
    async with db_pool.acquire() as conn:
        update = "UPDATE users SET connected = false WHERE code = $1"
        await conn.execute(update, code)
        logger.info(f"Client {code} disconnected.")

async def handle_websocket(websocket, path, db_pool):
    try:
        # Authentication and initial data reception
        auth_message = await websocket.recv()
        client_data = ClientData(**json.loads(auth_message))

        if await is_client_connected(db_pool, client_data.code):
            logger.warning(f"Connection refused for code: {client_data.code}. Already connected.")
            await websocket.close(1000, "Connection already exists")
            return

        if await validate_and_update_client(db_pool, client_data):
            # Main loop for handling subsequent messages
            async for message in websocket:
                try:
                    updated_data = ClientData(**json.loads(message))
                    await update_client_data(db_pool, updated_data)
                    await websocket.send(message)
                    logger.info(f"Authentication and update successful for code: {client_data.code}")
                except json.JSONDecodeError as e:
                    logger.warning(f"Error in deserializing updated data: {e}")

        else:
            logger.warning(f"Authentication failed for code: {client_data.code}")
            await websocket.close(1000, "Authentication failed")

    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        if 'client_data' in locals():
            await disconnect_client(db_pool, client_data.code)

async def main():
    db_pool = await asyncpg.create_pool(
        host="localhost",
        user="postgis",
        password="password",
        database="mydb"
    )

    server = await websockets.serve(
        lambda ws, path: handle_websocket(ws, path, db_pool),
        "127.0.0.1",
        8080
    )

    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())