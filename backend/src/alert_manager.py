import json

from datetime import datetime
from logging import Logger
from shapely import wkt
from shapely.geometry import Point, Polygon
from shapely.ops import transform
from shapely.wkt import loads
from typing import Any, Dict, List, Tuple, Optional
from pyproj import Transformer

from websockets import WebSocketServer
from database_manager import DatabaseManager
from kafka_manager import KafkaManager
from logging_utils import AdvancedLogger


class AlertManager:
    """
    Manages geospatial alerts and user proximity notifications in a real-time system.
    
    This class handles the creation, updating, and monitoring of geographical alert zones,
    tracks user positions relative to these zones, and sends notifications when users
    enter or exit different danger proximity levels (immediate, 1km, and 2km).
    
    The manager maintains an in-memory cache of active alerts and user danger states,
    integrates with a database for persistence, and uses Kafka for real-time messaging.
    """

    def __init__(self, 
                 database_manager: DatabaseManager, 
                 kafka_manager: KafkaManager, 
                 websocket_server: WebSocketServer, 
                 cache_ttl: int = 60) -> None:
        """
        Initialize the Alert Manager with necessary dependencies and configurations.
        
        Args:
        - database_manager (DatabaseManager): Manager for database operations
        - kafka_manager (KafkaManager): Manager for Kafka message broadcasting
        - websocket_server (WebSocketServer): WebSocket server for real-time communications
        - cache_ttl (int): Time-to-live for cached alerts in seconds (default: 60)
        """
        # Initialize core dependencies
        self.db: DatabaseManager = database_manager
        self.kafka: KafkaManager = kafka_manager
        self.websocket_server: WebSocketServer = websocket_server
        self.logger: Logger = AdvancedLogger.get_logger()
        self.cache_ttl: int = cache_ttl

        # Initialize in-memory storage for active alerts and user danger states
        self.alert_cache: List[Dict[str, Any]] = []
        self.user_in_danger: Dict[Tuple[str, str], str] = {}

        # Set up coordinate transformation system for distance calculations
        self.transformer: Transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

        # Define notification message templates for different danger zones
        self.messages: Dict[str, str] = {
            "inside": "URGENT! You are in a",
            "in_1km": "ALERT! You are within 1km of a",
            "in_2km": "ATTENTION! You are within 2km of a"
        }

    def serialize_data(self, item: Any) -> str:
        """
        Helper function to serialize datetime objects for JSON encoding.
        """
        if isinstance(item, datetime):
            return item.isoformat()
        return item

    async def sync_alert_cache(self, alert: Dict[str, Any]) -> None:
        """
        Synchronize alert cache with new or updated alert information.
        
        Handles both alert termination and new alert creation, updating both
        the cache and persistent storage while notifying affected users.
        
        Args:
        - alert (Dict[str, Any]): Alert data containing either time_end or geofence information
        
        Raises:
        - Exception: If the alert format is invalid or the datetime
        """
        if not isinstance(alert, dict):
            self.logger.exception("Invalid alert format, expected a dictionary.")
            raise Exception("Invalid alert format, expected a dictionary.")
    
        # Handle alert termination
        if 'time_end' in alert:

            alert_polygon = loads(alert['geofence'])  # Convert WKT string to Polygon
            if alert_polygon in [present['geofence'] for present in self.alert_cache]:
            
                # Update database and broadcast the update message
                await self.db.update_alert(alert['time_end'], alert['geofence'])
                
                # Remove alert from cache and notify affected users
                self.alert_cache = [a for a in self.alert_cache if a['geofence'] != alert['geofence']]
                for (code, geofence), zone in list(self.user_in_danger.items()):
                    if geofence == alert['geofence']:
                        await self.notify_users(code, None, f"Alert {alert['geofence']} has ended.")
                        self.user_in_danger.pop((code, geofence))
                
                # Create or retrieve the alert in the database and return the serialized data
                created_alert = await self.db.create_alert(alert['geofence'], formatted_date, alert['description'])
                if not created_alert:
                    self.logger.exception("Failed to create or retrieve alert from the database.")
                    raise Exception("Failed to create or retrieve alert from the database.")

                return {key: self.serialize_data(value) for key, value in created_alert.items()}

        # Handle new alert creation
        elif 'geofence' in alert:
            try:
                # Parse and normalize the datetime
                formatted_date: datetime = datetime.fromisoformat(
                    alert['time_start'].replace("Z", "+00:00")
                ).replace(tzinfo=None)
            except ValueError:
                self.logger.exception(f"Invalid datetime format in time_start: {alert['time_start']}")
                raise Exception("Invalid alert format, expected a dictionary.")

            try:
                # Parse geofence data, handling both WKT and raw coordinate formats
                if alert['geofence'].strip().startswith(('POLYGON', 'LINESTRING', 'POINT')):
                    polygon: Polygon = wkt.loads(alert['geofence'])
                else:
                    # Parse raw coordinate pairs and create a polygon
                    pairs: List[str] = alert['geofence'].split(", ")
                    coordinates: List[Tuple[float, float]] = [
                        (float(lon), float(lat)) for lon, lat in (pair.split() for pair in pairs)
                    ]
                    polygon = Polygon(coordinates)
                    alert['geofence'] = polygon.wkt
            except Exception as e:
                self.logger.exception(f"Failed to parse geofence: {alert['geofence']}, Error: {e}")
                raise Exception("Invalid alert format, expected a dictionary.")

            alert_polygon = loads(alert['geofence'])  # Convert WKT string to Polygon
            if alert_polygon not in [present['geofence'] for present in self.alert_cache]:
                # Cache the new alert
                self.alert_cache.append({
                    "geofence": polygon,
                    "time_start": alert['time_start'],
                    "description": alert['description']
                })

                # Notify affected users
                for user_code, zone in await self.db.check_users_in_danger(alert):
                    await self.notify_users(user_code, zone, alert['description'])
                    self.user_in_danger[(user_code, alert['geofence'])] = zone

                self.logger.info(f"Alert cache updated and synchronized for {alert['description']}")

                # Create or retrieve the alert in the database and return the serialized data
                created_alert = await self.db.create_alert(alert['geofence'], formatted_date, alert['description'])
                if not created_alert:
                    self.logger.exception("Failed to create or retrieve alert from the database.")
                    raise Exception("Failed to create or retrieve alert from the database.")

                return {key: self.serialize_data(value) for key, value in created_alert.items()}

    async def process_user_update(self, code: str, position: Dict[str, float]) -> None:
        """
        Process a user's position update and check for proximity to danger zones.
        
        Transforms coordinates, calculates distances to all active alert zones,
        and sends notifications when users enter or exit different danger levels.
        
        Args:
        - code (str): User identifier
        - position (Dict[str, float]): User's position with 'lat' and 'lon' keys
        """
        # Transform user coordinates to projected system for accurate distance calculation
        current_position: Point = Point(position['lon'], position['lat'])
        current_position_proj: transform = transform(self.transformer.transform, current_position)
        current_position: Point = Point(position['lon'], position['lat'])
        current_position_proj: Point = transform(self.transformer.transform, current_position)

        # Check user's proximity to each active alert zone
        for alert in self.alert_cache:
            # Transform alert geofence to projected system for distance calculation
            alert_geofence_proj: Polygon = transform(self.transformer.transform, alert['geofence'])
            geofence_key: Tuple[str, str] = (code, alert['geofence'].wkt)

            # Check if user is already in a danger zone
            zone: Optional[str] = self.user_in_danger.get(geofence_key)

            # Calculate distance between user and alert zone
            distance_meters: float = current_position_proj.distance(alert_geofence_proj)
            distance_km: float = distance_meters / 1000

            # Update danger zone status based on distance
            match distance_km:
                case distance if distance <= 0:
                    if zone != 'inside':
                        await self.notify_users(code, 'inside', alert['description'])
                        self.user_in_danger[geofence_key] = 'inside'
                case distance if distance <= 1:
                    if zone != 'in_1km':
                        await self.notify_users(code, 'in_1km', alert['description'])
                        self.user_in_danger[geofence_key] = 'in_1km'
                case distance if distance <= 2:
                    if zone != 'in_2km':
                        await self.notify_users(code, 'in_2km', alert['description'])
                        self.user_in_danger[geofence_key] = 'in_2km'
                case _:
                    # Clear danger status if user has moved out of all zones
                    if zone is not None:
                        await self.notify_users(code, None, f"Exited danger zone for {alert['description']}")
                        self.user_in_danger.pop(geofence_key, None)

    async def notify_users(self, code: str, zone: Optional[str], description: str) -> None:
        """
        Send a notification message to users about their danger zone status.
        
        Args:
        - code (str): User identifier
        - zone (Optional[str]): Danger zone level ('inside', 'in_1km', 'in_2km', or None)
        - description (str): Alert description
        """
        await self.kafka.send_message(
            'users-in-danger',
            f"code: {code}, message: {self.messages[zone] if zone is not None else ''} {description}"
        )

    async def start(self) -> None:
        """
        Initialize the Alert Manager by loading active alerts from the database.
        
        Converts stored alerts to the required format and populates the alert cache.
        
        Raises:
        - Exception: If Kafka services are not running
        """
        # Verify Kafka connection
        if not await self.kafka.is_running():
            self.logger.exception("Kafka services not running")
            raise Exception("Kafka services not running")

        # Load active alerts from the database
        for record in await self.db.get_active_alerts():
            # Parse alert data from database records
            geojson: Dict[str, Any] = json.loads(record["st_asgeojson"])
            coordinates: List[List[float]] = geojson.get("coordinates", [[]])[0]
            geofence: str = ", ".join(f"{lon} {lat}" for lon, lat in coordinates)

            # Convert alert data to the required format
            time_start: str = record["time_start"].isoformat()
            alert: Dict[str, Any] = {
                "geofence": geofence,
                "time_start": time_start,
                "description": record["description"]
            }

            # Cache the alert and notify affected users
            await self.sync_alert_cache(alert)
