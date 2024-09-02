// components/MapComponent.js
"use client"
import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

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

      // Clean up on component unmount      
      return () => map.setTarget(undefined);
    }
  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapComponent;
