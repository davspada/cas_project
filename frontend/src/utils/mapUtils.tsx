import { Coordinate } from 'ol/coordinate';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import Map from 'ol/Map';

export function getClosestFeatureByWorldDistance(features: Feature[], pixel: Coordinate, map: Map): Feature | null {
    if (features.length === 0) return null;

    // Convert the cursor's pixel location to map coordinates
    const cursorCoords = map.getCoordinateFromPixel(pixel);

    // Calculate distances from the cursor to each feature's centroid in world coordinates
    const distances = features.map((feature) => {
        const geometry = feature.getGeometry() as Point;
        const featureCoords = geometry.getCoordinates();
        const distance = Math.hypot(cursorCoords[0] - featureCoords[0], cursorCoords[1] - featureCoords[1]);
        return { feature, distance };
    });

    // Sort features by distance to find the closest
    distances.sort((a, b) => a.distance - b.distance);
    return distances[0].feature;
}

export const countUsersInGeofence = (geofence: Feature, users: Feature[]): number => {
    const geometry = geofence.getGeometry();
    if (!geometry) return 0;

    return users.filter((user) => {
        const userGeometry = user.getGeometry() as Point;
        return geometry.intersectsCoordinate(userGeometry.getCoordinates());
    }).length;
};