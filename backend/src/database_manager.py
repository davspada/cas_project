from datetime import datetime
from logging import Logger
from typing import List
import asyncpg
from logging_utils import AdvancedLogger

class DatabaseManager:
    """
    Manages PostgreSQL database operations for the real-time tracking system.
    
    This class handles all database interactions including:
    - User management (creation, updates, queries)
    - Alert management (creation, updates, queries)
    - Geospatial operations using PostGIS
    - Connection pooling and lifecycle management
    
    The manager uses asyncpg for asynchronous database operations and supports
    PostGIS geometry types for location-based queries.
    """

    def __init__(self, config: dict[str: str]):
        """
        Initialize the database manager with configuration settings.
        
        Args:
        config (dict): Database configuration parameters including:
        - host: Database server hostname
        - port: Database server port
        - database: Database name
        - user: Database username
        - password: Database password
        """
        # Store database configuration
        self.config: dict[str: str] = config
        # Initialize logger for database operations
        self.logger: Logger = AdvancedLogger.get_logger()
        # Connection pool (initialized in connect())
        self.pool: asyncpg.Pool = None
        # Predefined alert messages for different danger zones
        self.messages: dict[str: str] = {
            "inside": "URGENT! You are in a",
            "in_1km": "ALERT! You are within 1km of a",
            "in_2km": "ATTENTION! You are within 2km of a"
        }

    async def connect(self):
        """
        Establish connection pool to the database.
        Creates a connection pool using the provided configuration settings.
        
        Raises:
        - Exception: If connection to database fails
        """
        try:
            self.logger.info("Connecting to database...")
            self.pool = await asyncpg.create_pool(**self.config)
            self.logger.info("Connected to database")
        except Exception as e:
            self.logger.exception("Failed to connect to the database")
            raise

    async def close(self):
        """
        Gracefully close the database connection pool.
        """
        if self.pool:
            await self.pool.close()

    async def update_user_location(self, code: str, position: str):
        """
        Update a user's geographic position.
        
        Args:
        - code (str): User's unique identifier
        - position (dict): Dictionary containing 'lat' and 'lon' coordinates
        """
        async with self.pool.acquire() as conn:
            # Create PostGIS point geometry from coordinates
            await conn.execute(
                "UPDATE USERS SET position = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE code = $3",
                position['lon'], position['lat'], code
            )

    async def update_transport_method(self, code: str, transport_method: str):
        """
        Update a user's transport method.
        
        Args:
        - code (str): User's unique identifier
        - transport_method (str): User's current mode of transport
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE USERS SET transport_method = $1 WHERE code = $2",
                transport_method, code
            )

    async def get_user_token(self, code: str) -> asyncpg.Record:
        """
        Retrieve a user's authentication token.
        
        Args:
        - code (str): User's unique identifier
            
        Returns:
        - Record: Database record containing user's token
        """
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT token FROM USERS WHERE code = $1", code)

    async def create_user(self, code, token):
        """
        Create a new user record.
        
        Args:
        - code (str): User's unique identifier
        - token (str): Authentication token for the user
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO USERS (code, token, connected) VALUES ($1, $2, false)",
                code, token
            )

    async def update_user_connection(self, code: str, connected: bool):
        """
        Update a user's connection status.
        
        Args:
        - code (str): User's unique identifier
        - connected (bool): Whether the user is currently connected
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE USERS SET connected = $1 WHERE code = $2",
                connected, code
            )

    async def get_connected_users(self) -> List[asyncpg.Record]:
        """
        Retrieve all currently connected users with their positions.
        
        Returns:
        - List[Record]: List of connected users with their positions and transport methods
        """
        async with self.pool.acquire() as conn:
            # Only return users with complete information
            return await conn.fetch("""
                SELECT code, ST_AsGeoJSON("position"), transport_method 
                FROM USERS 
                WHERE connected = true 
                AND position IS NOT NULL 
                AND transport_method IS NOT NULL
            """)

    async def get_active_alerts(self) -> List[asyncpg.Record]:
        """
        Retrieve all active (non-ended) alerts.
        
        Returns:
        - List[Record]: List of active alerts with their geofences and details
        """
        async with self.pool.acquire() as conn:
            return await conn.fetch("""
                SELECT id, ST_AsGeoJSON("geofence"), time_start, description 
                FROM ALERTS 
                WHERE time_end IS NULL
            """)

    async def update_alert(self, time_end: datetime, geofence: str):
        """
        Update an alert's end time.
        
        Args:
        - time_end (datetime): When the alert ends
        - geofence (str): WKT representation of the alert's geometry
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE ALERTS SET time_end = $1 WHERE geofence = $2",
                time_end, geofence
            )

    async def create_alert(self, geofence: str, time_start: datetime, description: str):
        """
        Create a new alert.
        
        Args:
        - geofence (str): WKT representation of the alert's geometry
        - time_start (datetime): When the alert starts
        - description (str): Description of the alert
        """
        async with self.pool.acquire() as conn:
            # Convert WKT to PostGIS geometry
            await conn.execute(
                "INSERT INTO ALERTS (geofence, time_start, description) VALUES (ST_GeomFromText($1, 4326), $2, $3)",
                geofence, time_start, description
            )

    async def check_users_in_danger(self, data: dict) -> List[str]:
        """
        Check for users within different danger zones of an alert.
        
        Performs spatial queries to find users:
        1. Inside the alert area
        2. Within 1km of the alert area
        3. Within 2km of the alert area
        
        Args:
        - data (dict): Alert data containing geofence and description
            
        Returns:
        - List[str]: Messages for users in danger zones
        """
        async with self.pool.acquire() as conn:
            # Define queries for different danger zones using PostGIS functions
            query_templates: dict[str, str] = {
                'inside': """
                    SELECT code
                    FROM users
                    WHERE ST_Within(position, ST_SetSRID(ST_GeomFromText($1), 4326)) AND connected = true;
                """,
                'in_1km': """
                    SELECT code
                    FROM users
                    WHERE ST_DWithin(
                        ST_Transform(position, 3857), 
                        ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857), 
                        1000
                    )
                    AND NOT ST_Within(position, ST_SetSRID(ST_GeomFromText($1), 4326))
                    AND connected = true;
                """,
                'in_2km': """
                    SELECT code
                    FROM users
                    WHERE ST_DWithin(
                        ST_Transform(position, 3857), 
                        ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857), 
                        2000
                    )
                    AND NOT ST_DWithin(
                        ST_Transform(position, 3857), 
                        ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857), 
                        1000
                    )
                    AND connected = true;
                """
            }
            
            # Explicit declaration of this variable to avoid type errors
            messages: List[str] = []

            # Check each danger zone and generate appropriate messages
            for zone, query in query_templates.items():
                for user in await conn.fetch(query, data["geofence"]):
                    messages.append(
                        f"code: {user['code']}, message: {self.messages[zone]} {data['description']}"
                    )

            return messages