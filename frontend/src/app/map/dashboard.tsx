"use client";
import { useState, useEffect } from "react";
import MapContainer from "@/components/MapContainer";
import { LoadingSpinner } from "@/components/loading_spinner";
import { useWebSocket } from "@/contexts/WebSocketProvider";

const Dashboard = () => {
  const [mobilityFilter, setMobilityFilter] = useState("all");
  const [userPositions, setUserPositions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [numClusters, setNumClusters] = useState(1);
  const [clusteringMode, setClusteringMode] = useState("automatic");
  const [showGeofences, setShowGeofences] = useState(true);
  const [drawingMode, setDrawingMode] = useState<null | "Polygon" | "Circle">(null);
  const [isEditingGeofences, setIsEditingGeofences] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  const { sendMessage, isConnected, latestMessage } = useWebSocket();

  useEffect(() => {
    if (latestMessage) {
      console.log("New data from WebSocket:", latestMessage);

      // Transform the user data
      const transformedUserPositions = latestMessage.users.map((user: any) => ({
        type: "Feature",
        geometry: JSON.parse(user.st_asgeojson),
        properties: {
          id: user.code, // Use `code` as the unique identifier
          transportation_mode: user.transport_method,
        },
      }));

      setUserPositions(transformedUserPositions);

      // Transform the alert data
      const transformedAlerts = latestMessage.alerts.map((alert: any) => ({
        type: "Feature",
        geometry: JSON.parse(alert.st_asgeojson),
        properties: {
          time_start: alert.time_start,
          description: alert.description,
        },
      }));

      setAlerts(transformedAlerts);
    }
  }, [latestMessage]);

  useEffect(() => {
    if (isConnected) {
      sendMessage(JSON.stringify({ type: "init", payload: "Dashboard connected" }));
    }
  }, [isConnected, sendMessage]);

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      {/* Map Container */}
      {userPositions.length > 0 ? (
        <MapContainer
          userPositions={userPositions}
          mapalerts={alerts}
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

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          background: "rgba(255, 255, 255, 0.9)",
          borderRadius: "10px",
          padding: "10px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
          display: isOverlayVisible ? "block" : "none",
        }}
      >
      {/* Mobility Filter */}
      <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "flex-center", gap: "5px" }}>
        <label
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#333",
          }}
        >
          Filter by Mobility:
        </label>
        <select
          value={mobilityFilter}
          onChange={(e) => setMobilityFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            backgroundColor: "#f9f9f9",
            color: "#333",
            cursor: "pointer",
            outline: "none",
            transition: "border-color 0.3s",
          }}
        >
          <option value="all">All</option>
          <option value="walking">Walking</option>
          <option value="car">Car</option>
        </select>
      </div>

      {/* Clustering Mode */}
      <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
        <label
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#333",
          }}
        >
          Clustering Mode:
        </label>
        <select
          value={clusteringMode}
          onChange={(e) => setClusteringMode(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            backgroundColor: "#f9f9f9",
            color: "#333",
            cursor: "pointer",
            outline: "none",
            transition: "border-color 0.3s",
          }}
        >
          <option value="automatic">Automatic (Elbow Method)</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Cluster Number Slider */}
      {clusteringMode === "manual" && (
        <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
          <label
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              color: "#333",
            }}
          >
            Number of Clusters: {numClusters}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={numClusters}
            onChange={(e) => setNumClusters(Number(e.target.value))}
            style={{
              width: "100%",
              maxWidth: "300px",
              appearance: "none",
              height: "8px",
              borderRadius: "5px",
              background: "#ddd",
              outline: "none",
              transition: "background-color 0.3s",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              maxWidth: "300px",
              fontSize: "12px",
              color: "#555",
            }}
          >
            <span>1</span>
            <span>10</span>
          </div>
        </div>
      )}
      </div>

      {/* Overlay Toggle Button */}
      <button
        onClick={() => setIsOverlayVisible(!isOverlayVisible)}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          border: "none",
          borderRadius: "4px",
          padding: "10px 15px",
          cursor: "pointer",
        }}
      >
        {isOverlayVisible ? "Hide Options" : "Show Options"}
      </button>
    </div>
  );
};

export default Dashboard;
