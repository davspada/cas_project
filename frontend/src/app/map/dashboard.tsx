"use client";
import { useState, useEffect } from 'react';
import MapContainer from '@/components/MapContainer';

const Dashboard = () => {
  const [mobilityFilter, setMobilityFilter] = useState('all');
  const [userPositions, setUserPositions] = useState([]);
  const [numClusters, setNumClusters] = useState(1);
  const [clusteringMode, setClusteringMode] = useState('automatic'); // New state for clustering mode

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

      {/* Only render MapContainer when userPositions is not empty */}
      {userPositions.length > 0 ? (
        <MapContainer 
          userPositions={userPositions} 
          mobilityFilter={mobilityFilter} 
          numClusters={numClusters} 
          clusteringMode={clusteringMode} // Pass clusteringMode to MapContainer
        />
      ) : (
        <p>Loading map data...</p>
      )}
    </div>
  );
};

export default Dashboard;
