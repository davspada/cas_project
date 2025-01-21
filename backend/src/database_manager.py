import asyncpg

from datetime import datetime
from logging import Logger
from typing import Any, List, Dict, Optional, Tuple

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

    def __init__(self, config: Dict[str, str]) -> None:
        """
        Initialize the database manager with configuration settings.
        
        Args:
        config (Dict[str, str]): Database configuration parameters including:
        - host: Database server hostname
        - port: Database server port
        - database: Database name
        - user: Database username
        - password: Database password
        """
        # Store database configuration
        self.config: Dict[str, str] = config
        # Initialize logger for database operations
        self.logger: Logger = AdvancedLogger.get_logger()
        # Connection pool (initialized in connect())
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
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

    async def close(self) -> None:
        """
        Gracefully close the database connection pool.
        """
        if self.pool:
            await self.pool.close()

    async def update_user_location(self, code: str, position: Dict[str, float]) -> None:
        """
        Update a user's geographic position.
        
        Args:
        - code (str): User's unique identifier
        - position (Dict[str, float]): Dictionary containing 'lat' and 'lon' coordinates
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE USERS SET position = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE code = $3",
                position['lon'], position['lat'], code
            )

    async def update_transport_method(self, code: str, transport_method: str) -> None:
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

    async def get_user_token(self, code: str) -> Optional[asyncpg.Record]:
        """
        Retrieve a user's authentication token.
        
        Args:
        - code (str): User's unique identifier
            
        Returns:
        - Record: Database record containing user's token
        """
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT token FROM USERS WHERE code = $1", code)

    async def create_user(self, code: str, token: str) -> None:
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

    async def update_user_connection(self, code: str, connected: bool) -> None:
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
            return await conn.fetch(
                """
                SELECT code, ST_AsGeoJSON("position"), transport_method 
                FROM USERS 
                WHERE connected = true 
                AND position IS NOT NULL 
                AND transport_method IS NOT NULL
                """
            )

    async def get_active_alerts(self) -> List[asyncpg.Record]:
        """
        Retrieve all active (non-ended) alerts.
        
        Returns:
        - List[Record]: List of active alerts with their geofences and details
        """
        async with self.pool.acquire() as conn:
            return await conn.fetch(
                """
                SELECT id, ST_AsGeoJSON("geofence"), time_start, description 
                FROM ALERTS 
                WHERE time_end IS NULL
                """
            )

    async def update_alert(self, time_end: datetime, geofence: str) -> None:
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

    async def create_alert(self, geofence: str, time_start: datetime, description: str) -> Optional[Dict[str, Any]]:
        """
        Create a new alert or return an existing one if it already exists.
        
        Args:
        - geofence (str): WKT representation of the alert's geometry
        - time_start (datetime): When the alert starts
        - description (str): Description of the alert
        
        Returns:
        - Dict[str, Any]: Details of the created or existing alert
        - None: If no action was performed (e.g., invalid geofence)
        """
        async with self.pool.acquire() as conn:
            # Check if the geofence already exists
            existing_alert = await conn.fetchrow(
                """
                SELECT id, ST_AsGeoJSON("geofence"), time_start, description
                FROM ALERTS 
                WHERE geofence = ST_GeomFromText($1, 4326) AND time_end IS NULL
                """,
                geofence
            )
            if existing_alert:
                return dict(existing_alert)

            # Insert new alert
            await conn.execute(
                """
                INSERT INTO ALERTS (geofence, time_start, description) 
                VALUES (ST_GeomFromText($1, 4326), $2, $3)
                """,
                geofence, time_start, description
            )

            # Fetch and return the newly created alert
            new_alert = await conn.fetchrow(
                """
                SELECT id, ST_AsGeoJSON("geofence"), time_start, description
                FROM ALERTS 
                WHERE geofence = ST_GeomFromText($1, 4326) AND time_end IS NULL
                """, geofence
            )
            if new_alert:
                return dict(new_alert)
            
            self.logger.error("Failed to create or fetch the new alert")
            return None


    async def check_users_in_danger(self, data: Dict[str, Any]) -> List[Tuple[str, str]]:
        """
        Check for users within different danger zones of an alert.
        
        Performs spatial queries to find users:
        1. Inside the alert area
        2. Within 1km of the alert area
        3. Within 2km of the alert area
        
        Args:
        - data (Dict[str, Any]): Alert data containing geofence and description
            
        Returns:
        - List[Tuple[str, str]]: A list of tuples where each tuple contains the user code and the danger zone.
        """
        async with self.pool.acquire() as conn:
            # Combined query to fetch users for all zones
            query = """
                SELECT code, 
                    CASE 
                        WHEN ST_Within(position, ST_SetSRID(ST_GeomFromText($1), 4326)) THEN 'inside'
                        WHEN ST_DWithin(
                                ST_Transform(position, 3857), 
                                ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857), 
                                1000
                        ) AND NOT ST_Within(position, ST_SetSRID(ST_GeomFromText($1), 4326)) THEN 'in_1km'
                        WHEN ST_DWithin(
                                ST_Transform(position, 3857), 
                                ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857), 
                                2000
                        ) AND NOT ST_DWithin(
                                ST_Transform(position, 3857), 
                                ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857), 
                                1000
                        ) THEN 'in_2km'
                        ELSE NULL
                    END AS zone
                FROM users
                WHERE connected = true
                AND (
                    ST_Within(position, ST_SetSRID(ST_GeomFromText($1), 4326)) OR
                    ST_DWithin(
                        ST_Transform(position, 3857), 
                        ST_Transform(ST_SetSRID(ST_GeomFromText($1), 4326), 3857), 
                        2000
                    )
                );
            """
            rows = await conn.fetch(query, data["geofence"])
            
            # Filter out rows with NULL zone values
            return [(row["code"], row["zone"]) for row in rows if row["zone"] is not None]
