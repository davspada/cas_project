import { Geometry } from 'ol/geom';

export interface UserPosition {
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: {
      id: number;
      transportation_mode: string;
    };
  }
  

export interface Alert {
      id: number;
      geofence: Geometry; // Using OpenLayers Geometry type
      time_start: string; // ISO timestamp string
      time_end?: string; // Optional ISO timestamp string
      description?: string; // Optional text
}
  
export interface User {
      id: number;
      code: string;
      connected: boolean;
      position?: Geometry; // Using OpenLayers Geometry type
      transport_mode?: string; // Optional varchar(50)
}