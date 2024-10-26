"use client";
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import { Feature } from 'ol';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Circle as CircleStyle, Fill, Style } from 'ol/style';
import { kMeansClustering } from '@/utils/kMeans';
import { UserPosition } from '@/types';
import VectorSource from 'ol/source/Vector';
import useUserMarkers from '@/hooks/useUserMarkers';

interface MapContainerProps {
  userPositions: UserPosition[];
  mobilityFilter: string;
  numClusters: number;
  clusteringMode: string;
}

const MapContainer: React.FC<MapContainerProps> = ({ userPositions, mobilityFilter, numClusters, clusteringMode }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const userMarkersLayerRef = useRef<VectorLayer | null>(null);
  const [zoomLevel, setZoomLevel] = useState(15);

  const filteredPositions = userPositions.filter(position => 
    mobilityFilter === 'all' || position.properties.transportation_mode === mobilityFilter
  );

  const autoClusterCount = Math.max(2, Math.min(6, Math.floor(zoomLevel / 1.5)));
  const actualClusterCount = clusteringMode === 'manual' ? numClusters : autoClusterCount;

  const clusters = kMeansClustering(filteredPositions, actualClusterCount);

  const clusterFeatures = clusters.map(cluster => {
    const [lon, lat] = cluster.centroid;
    return new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
    });
  });

  const userMarkersSource = useUserMarkers({ userPositions, mobilityFilter });

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const baseMap = new TileLayer({
        source: new OSM(),
      });

      mapInstanceRef.current = new Map({
        target: mapRef.current,
        layers: [baseMap],
        view: new View({
          center: fromLonLat([11.3394883, 44.4938134]),
          zoom: zoomLevel,
        }),
      });

      userMarkersLayerRef.current = new VectorLayer({
        source: new VectorSource({
          features: clusterFeatures,
        }),
        style: new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: 'blue' }),
          }),
        }),
      });
      mapInstanceRef.current.addLayer(userMarkersLayerRef.current);

      mapInstanceRef.current.getView().on('change:resolution', () => {
        const newZoomLevel = Math.round(mapInstanceRef.current!.getView().getZoom() ?? zoomLevel);
        setZoomLevel(newZoomLevel);
      });
    }
  }, []);

  useEffect(() => {
    if (userMarkersLayerRef.current) {
      const clusteredSource = new VectorSource({
        features: clusterFeatures,
      });

      userMarkersLayerRef.current.setSource(clusteredSource);
    }
  }, [clusters]);

  useEffect(() => {
    if (userMarkersLayerRef.current) {
      if (zoomLevel >= 18) {
        userMarkersLayerRef.current.setSource(userMarkersSource);
      } else {
        const clusteredSource = new VectorSource({
          features: clusterFeatures,
        });
        userMarkersLayerRef.current.setSource(clusteredSource);
      }
    }
  }, [zoomLevel, userMarkersSource]);

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapContainer;
