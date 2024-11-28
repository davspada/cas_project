"use client";
import { useState, useEffect } from 'react';
import MapContainer from '@/components/MapContainer';
import { LoadingSpinner } from '@/components/loading_spinner';
import { useWebSocket } from '@/contexts/WebSocketProvider';

const Dashboard = () => {
  const [mobilityFilter, setMobilityFilter] = useState('all');
  const [userPositions, setUserPositions] = useState([]);
  const [numClusters, setNumClusters] = useState(1);
  const [clusteringMode, setClusteringMode] = useState('automatic');
  const [showGeofences, setShowGeofences] = useState(true);
  const [drawingMode, setDrawingMode] = useState<null | 'Polygon' | 'Circle'>(null);
  const [isEditingGeofences, setIsEditingGeofences] = useState(false);

  const { sendMessage, isConnected, latestMessage } = useWebSocket();

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (latestMessage) {
      console.log('New data from WebSocket:', latestMessage);
  
      // Transform the user data
      const transformedUserPositions = latestMessage.users.map((user: any) => ({
        type: 'Feature',
        geometry: JSON.parse(user.st_asgeojson),
        properties: {
          id: user.code, // Use `code` as the unique identifier
          transportation_mode: user.transport_method,
        },
      }));
  
      setUserPositions(transformedUserPositions);
      console.log('Transformed user positions:', transformedUserPositions);
    }
  }, [latestMessage]);
  

  useEffect(() => {
    if (isConnected) {
      sendMessage(JSON.stringify({ type: 'init', payload: 'Dashboard connected' }));
    }
  }, [isConnected, sendMessage]);

  return (
    <div>
      <h1>Municipality Dashboard</h1>

      {/* Mobility Filter Dropdown */}
      <div>
        <label>Filter by Mobility: </label>
        <select value={mobilityFilter} onChange={(e) => setMobilityFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="walking">Walking</option>
          <option value="car">Car</option>
        </select>
      </div>

      {/* Clustering Mode Toggle */}
      <div>
        <label>Clustering Mode: </label>
        <select value={clusteringMode} onChange={(e) => setClusteringMode(e.target.value)}>
          <option value="automatic">Automatic (Elbow Method)</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Cluster Number Slider */}
      {clusteringMode === 'manual' && (
        <div>
          <label>Number of Clusters: {numClusters}</label>
          <input
            type="range"
            min="1"
            max="10"
            value={numClusters}
            onChange={(e) => setNumClusters(Number(e.target.value))}
          />
        </div>
      )}

      {/* Map Container */}
      {userPositions.length > 0 ? (
        <MapContainer
          userPositions={userPositions}
          mobilityFilter={mobilityFilter}
          numClusters={numClusters}
          clusteringMode={clusteringMode}
          showGeofences={showGeofences}
          drawingMode={drawingMode}
          isEditingGeofences={isEditingGeofences}
          onDrawingModeChange={setDrawingMode}
        />
      ) : (
        <LoadingSpinner />
      )}
    </div>
  );
};

export default Dashboard;
