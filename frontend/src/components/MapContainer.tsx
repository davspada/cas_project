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
import { Style, Text, Fill, Stroke, Icon } from 'ol/style';

interface MapContainerProps {
  userPositions: Array<any>; // Adjust according to the structure of your data
  mobilityFilter: string;    // 'walking', 'car', or 'all'
}

const MapContainer: React.FC<MapContainerProps> = ({ userPositions, mobilityFilter }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    //DEBUG
    //console.log(userPositions);
    //console.log(mobilityFilter);
    if (mapRef.current) {
      // Create the base map layer
      const baseMap = new TileLayer({
        source: new OSM(),
      });

      const map = new Map({
        target: mapRef.current,
        layers: [baseMap], // Only the base layer initially
        view: new View({
          center: fromLonLat([11.3394883, 44.4938134]), // Center on Bologna
          zoom: 15,
        }),
      });

      // Define a function to create style for the user points
      const getUserStyle = (mobility: string, id: string) => {
        const iconSrc = mobility === 'walking' ? '/icons/walking-solid.png' : '/icons/car-solid.png';
        return new Style({
          image: new Icon({
          src: iconSrc,
          scale: 1, // Adjust the scale as needed
          }),
          text: new Text({
        text: id,
        scale: 1.5,
        fill: new Fill({ color: '#000' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
        offsetY: 15, // Adjust the offset as needed
          }),
        });
      };

      // Function to create features based on user positions and mobility type
      const createFeatures = (positions: Array<any>, mobility: string) => {
        return positions
          .filter(pos => pos.properties.transportation_mode === mobility) // Use the correct property name
          .map((feature) => {
            const [lon, lat] = feature.geometry.coordinates;
            const pointFeature = new Feature({
              geometry: new Point(fromLonLat([lon, lat])),
              id: feature.properties.id,
            });
            pointFeature.setStyle(getUserStyle(feature.properties.transportation_mode, feature.properties.id));
            return pointFeature;
          });
      };

      // Create separate vector layers for walking and car users
      const walkingUsersSource = new VectorSource({
        features: createFeatures(userPositions, 'walking'),
      });

      const carUsersSource = new VectorSource({
        features: createFeatures(userPositions, 'car'),
      });

      const walkingLayer = new VectorLayer({
        source: walkingUsersSource,
        visible: mobilityFilter === 'walking' || mobilityFilter === 'all', // Visible if filter is 'walking' or 'all'
      });

      const carLayer = new VectorLayer({
        source: carUsersSource,
        visible: mobilityFilter === 'car' || mobilityFilter === 'all', // Visible if filter is 'car' or 'all'
      });

      // Add layers to the map
      map.addLayer(walkingLayer);
      map.addLayer(carLayer);

      // Clean up on component unmount
      return () => {
        map.setTarget(undefined);
      };
    }
  }, [userPositions, mobilityFilter]); // Re-run effect when userPositions or mobilityFilter changes

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapContainer;
