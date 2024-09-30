// hooks/useUserMarkers.ts
import { useMemo } from 'react';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Icon, Text, Fill, Stroke } from 'ol/style';
import VectorSource from 'ol/source/Vector';

interface UserPosition {
  properties: {
    id: string;
    transportation_mode: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

interface UseUserMarkersParams {
  userPositions: Array<UserPosition>;
  mobilityFilter: string; // 'walking', 'car', or 'all'
}

const useUserMarkers = ({ userPositions, mobilityFilter }: UseUserMarkersParams) => {
  // Define a function to create the style for the user points
  const getUserStyle = (mobility: string, id: string) => {
    const iconSrc = mobility === 'walking' ? '/icons/walking-solid.png' : '/icons/car-solid.png';

    return new Style({
      image: new Icon({
        src: iconSrc,
        scale: 1,
      }),
      text: new Text({
        text: id,
        scale: 1.5,
        fill: new Fill({ color: '#000' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
        offsetY: 15,
      }),
    });
  };

  // Memoize the vector source to avoid unnecessary recalculations
  const vectorSource = useMemo(() => {
    const features = userPositions
      .filter((pos) => mobilityFilter === 'all' || pos.properties.transportation_mode === mobilityFilter)
      .map((feature) => {
        const [lon, lat] = feature.geometry.coordinates;

        // Create a new feature with point geometry
        const pointFeature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          id: feature.properties.id,
        });

        // Set the style for the feature based on mobility type
        pointFeature.setStyle(getUserStyle(feature.properties.transportation_mode, feature.properties.id));

        return pointFeature;
      });

    // Return the new vector source
    return new VectorSource({
      features,
    });
  }, [userPositions, mobilityFilter]);

  return vectorSource;
};

export default useUserMarkers;
