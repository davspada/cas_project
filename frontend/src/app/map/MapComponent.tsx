"use client";
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

const MapComponent = () => {
  const mapRef = useRef(null);

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
          center: fromLonLat([11.3394883, 44.4938134]),
          zoom: 15,
        }),
      });

      // Function to fetch points from the API
      const fetchPoints = async () => {
        try {
          const response = await fetch('http://localhost:3001/api/users'); // Adjust the API endpoint as needed
          const geojsonData = await response.json();

          // Create a vector source and add features
          const vectorSource = new VectorSource({
            features: geojsonData.features.map((feature) => {
              const [lon, lat] = feature.geometry.coordinates;

              // Create a new feature with the point geometry
              const pointFeature = new Feature({
                geometry: new Point(fromLonLat([lon, lat])),
                id: feature.properties.id,
              });

              // Set the style for the feature (icon marker and coordinates text)
              pointFeature.setStyle(new Style({
                image: new Icon({
                  src: 'https://openlayers.org/en/v4.6.5/examples/data/icon.png', // Standard OpenLayers marker icon
                  scale: 0.05, // Adjust scale as needed
                }),
                text: new Text({
                  text: `${lon.toFixed(4)}, ${lat.toFixed(4)}`, // Display the coordinates
                  offsetY: -25, // Offset to place the text above the marker
                  fill: new Fill({ color: '#000' }),
                  stroke: new Stroke({ color: '#fff', width: 2 }),
                }),
              }));

              return pointFeature;
            }),
          });

          // Create and add the vector layer to the map
          const vectorLayer = new VectorLayer({
            source: vectorSource,
          });
          map.addLayer(vectorLayer);
        } catch (error) {
          console.error('Error fetching points:', error);
        }
      };

      fetchPoints(); // Call the function to fetch and display points

      // Clean up on component unmount
      return () => map.setTarget(undefined);
    }
  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapComponent;
