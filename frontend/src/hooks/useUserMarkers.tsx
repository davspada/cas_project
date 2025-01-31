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
  // Funzione per ottenere lo stile dell'utente
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

  // Memoization della vector source
  const vectorSource = useMemo(() => {
    if (!userPositions || userPositions.length === 0) {
      return new VectorSource(); // Evita errori se non ci sono posizioni
    }

    const features = userPositions
      .filter((pos) => mobilityFilter === 'all' || pos.properties.transportation_mode === mobilityFilter)
      .map((feature) => {
        const [lon, lat] = feature.geometry.coordinates;

        const pointFeature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          id: feature.properties.id,
        });

        pointFeature.setStyle(getUserStyle(feature.properties.transportation_mode, feature.properties.id));

        return pointFeature;
      });
    return new VectorSource({ features });
    
  }, [userPositions, mobilityFilter, userPositions.map(pos => pos.properties.transportation_mode)]);

  return vectorSource;
};

export default useUserMarkers;