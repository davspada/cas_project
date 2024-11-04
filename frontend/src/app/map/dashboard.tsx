"use client";
import { useState, useEffect } from 'react';
import MapContainer from '@/components/MapContainer';
import { LoadingSpinner } from '@/components/loading_spinner';

const Dashboard = () => {
  const [mobilityFilter, setMobilityFilter] = useState('all');
  const [userPositions, setUserPositions] = useState([]);
  const [numClusters, setNumClusters] = useState(1);
  const [clusteringMode, setClusteringMode] = useState('automatic'); // New state for clustering mode
  const [showGeofences, setShowGeofences] = useState(true); // Toggle for geofence visibility
  const [drawingMode, setDrawingMode] = useState<null | 'Polygon' | 'Circle'>(null); // Drawing mode for geofences
  const [isEditingGeofences, setIsEditingGeofences] = useState(false); // Toggle for geofence editing

  // Fetch user data from API
  useEffect(() => {
    const fetchUserPositions = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/users'); // Adjust API endpoint
        const data = await response.json();
        setUserPositions(data.features); // Assuming GeoJSON structure
      } catch (error) {
        console.error('Error fetching user positions:', error);
      }
    };
    
    fetchUserPositions();
  }, []);

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

      {/* Cluster Number Slider - Show only if manual mode is selected */}
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

      {/* Geofence Controls 
      <div>
        <label>Geofences:</label>
        <button onClick={() => setShowGeofences(!showGeofences)}>
          {showGeofences ? 'Hide Geofences' : 'Show Geofences'}
        </button>
        <button onClick={() => setDrawingMode('Polygon')}>Draw Polygon</button>
        <button onClick={() => setDrawingMode('Circle')}>Draw Circle</button>
        <button onClick={() => setIsEditingGeofences(!isEditingGeofences)}>
          {isEditingGeofences ? 'Disable Editing' : 'Enable Editing'}
        </button>
      </div>
      */}

      {/* Only render MapContainer when userPositions is not empty */}
      {userPositions.length > 0 ? (
        <MapContainer 
          userPositions={userPositions} 
          mobilityFilter={mobilityFilter} 
          numClusters={numClusters} 
          clusteringMode={clusteringMode} // Pass clusteringMode to MapContainer
          showGeofences={showGeofences} // Pass geofence toggle
          drawingMode={drawingMode} // Pass drawing mode for geofences
          isEditingGeofences={isEditingGeofences} // Pass editing mode for geofences
          onDrawingModeChange={setDrawingMode} // Reset drawing mode after drawing
        />
      ) : (
        <LoadingSpinner />
      )}
    </div>
  );
};

export default Dashboard;
