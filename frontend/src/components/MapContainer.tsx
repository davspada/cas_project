// components/MapContainer.tsx

"use client"; // Enables client-side rendering
import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import { fromLonLat } from 'ol/proj';
import { Style, Icon, Text, Fill, Stroke } from 'ol/style';

interface MapContainerProps {
  userPositions: Array<any>; // Adjust according to the structure of your data
  mobilityFilter: string;
}

const MapContainer: React.FC<MapContainerProps> = ({ userPositions, mobilityFilter }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mapRef.current) {
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat([11.3394883, 44.4938134]), // Center on Bologna
          zoom: 15,
        }),
      });

      // Function to filter user positions based on mobility
      const filterUserPositions = (positions: Array<any>, filter: string) => {
        if (filter === 'all') return positions; // No filter
        return positions.filter(pos => pos.properties.mobility === filter); // Assuming `mobility` property
      };

      // Create a vector source and add filtered user features
      const vectorSource = new VectorSource({
        features: filterUserPositions(userPositions, mobilityFilter).map((feature) => {
          const [lon, lat] = feature.geometry.coordinates;

          const pointFeature = new Feature({
            geometry: new Point(fromLonLat([lon, lat])),
            id: feature.properties.id,
          });

          // Set the style for the feature (icon marker and coordinates text)
          pointFeature.setStyle(new Style({
            image: new Icon({
              src: 'https://openlayers.org/en/v4.6.5/examples/data/icon.png', // Standard marker icon
              scale: 0.05, // Adjust scale as needed
            }),
            text: new Text({
              text: `${lon.toFixed(4)}, ${lat.toFixed(4)}`, // Display coordinates
              offsetY: -25, // Offset text above the marker
              fill: new Fill({ color: '#000' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }));

          return pointFeature;
        }),
      });

      // Create and add the vector layer
      const vectorLayer = new VectorLayer({
        source: vectorSource,
      });

      map.addLayer(vectorLayer);

      // Clean up when component unmounts
      return () => map.setTarget(undefined);
    }
  }, [userPositions, mobilityFilter]); // Re-run when userPositions or mobilityFilter changes

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapContainer;
