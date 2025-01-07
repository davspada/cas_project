import asyncpg
from logging_utils import AdvancedLogger

class DatabaseManager:
    def __init__(self, config):
        self.config = config
        self.logger = AdvancedLogger.get_logger()
        self.pool = None
        self.messages = {
            "inside": "URGENT: You are in a ",
            "in_1km": "ALERT: You are within 1km of a ",
            "in_2km": "ATTENTION: You are within 2km of a "
        }

    async def connect(self):
        try:
            self.logger.info("Connecting to database...")
            self.pool = await asyncpg.create_pool(**self.config)
            self.logger.info("Connected to database")
        except Exception as e:
            self.logger.exception("Failed to connect to the database")
            raise

    async def close(self):
        if self.pool:
            await self.pool.close()

    async def update_user_location(self, code, position):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE USERS SET position = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE code = $3",
                position['lon'], position['lat'], code
            )

    async def update_transport_method(self, code, transport_method):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE USERS SET transport_method = $1 WHERE code = $2",
                transport_method, code
            )

    async def get_user_token(self, code):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT token FROM USERS WHERE code = $1", code)

    async def create_user(self, code, token):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO USERS (code, token, connected) VALUES ($1, $2, false)",
                code, token
            )

    async def update_user_connection(self, code, connected):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE USERS SET connected = $1 WHERE code = $2",
                connected, code
            )

    async def get_connected_users(self):
        async with self.pool.acquire() as conn:
            return await conn.fetch("""
                SELECT code, ST_AsGeoJSON("position"), transport_method 
                FROM USERS 
                WHERE connected = true 
                AND position IS NOT NULL 
                AND transport_method IS NOT NULL
            """)

    async def get_active_alerts(self):
        async with self.pool.acquire() as conn:
            return await conn.fetch("""
                SELECT id, ST_AsGeoJSON("geofence"), time_start, description 
                FROM ALERTS 
                WHERE time_end IS NULL
            """)

    async def update_alert(self, time_end, geofence):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE ALERTS SET time_end = $1 WHERE geofence = $2",
                time_end, geofence
            )

    async def create_alert(self, geofence, time_start, description):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO ALERTS (geofence, time_start, description) VALUES (ST_GeomFromText($1, 4326), $2, $3)",
                geofence, time_start, description
            )

    async def check_users_in_danger(self, data):
        async with self.db_pool.acquire() as conn:
            query_templates = {
                'inside': """
                    SELECT code
                    FROM users
                    WHERE ST_Within(position, ST_GeomFromGeoJSON($1)) AND connected = true;
                """,
                'in_1km': """
                    SELECT code
                    FROM users
                    WHERE ST_DWithin(ST_Transform(position, 3857), ST_Transform(ST_GeomFromGeoJSON($1), 3857), 1000)
                        AND NOT ST_Within(position, ST_GeomFromGeoJSON($1))
                        AND connected = true;
                """,
                'in_2km': """
                    SELECT code
                    FROM users
                    WHERE ST_DWithin(ST_Transform(position, 3857), ST_Transform(ST_GeomFromGeoJSON($1), 3857), 2000)
                        AND NOT ST_DWithin(ST_Transform(position, 3857), ST_Transform(ST_GeomFromGeoJSON($1), 3857), 1000)
                        AND connected = true;
                """
            }
            
            for zone, query in query_templates.items():
                for user in await conn.fetch(query, data["geofence"]):
                    self.kafka_producer.send(
                        'users-in-danger',
                        key=user['code'].encode('utf-8'),
                        value=self.messages[zone] + data["description"]
                    )