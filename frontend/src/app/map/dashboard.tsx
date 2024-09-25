// pages/dashboard.tsx
"use client"
import { useState, useEffect } from 'react';
import MapContainer from '@/components/MapContainer';

const Dashboard = () => {
  const [mobilityFilter, setMobilityFilter] = useState('all');
  const [userPositions, setUserPositions] = useState([]);

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
          <option value="biking">Biking</option>
          <option value="publicTransport">Public Transport</option>
        </select>
      </div>

      {/* MapContainer with props */}
      <MapContainer userPositions={userPositions} mobilityFilter={mobilityFilter} />
    </div>
  );
};

export default Dashboard;
