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
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: [];
  };
  properties: {
    time_start: string;
    description: string;
  };
}

  
export interface User {
      id: number;
      code: string;
      connected: boolean;
      position?: Geometry; // Using OpenLayers Geometry type
      transport_mode?: string; // Optional varchar(50)
}


/*
[
  {
    "code": "user001",
    "position": "0101000020E6100000560E2DB29DAF2640AC1C5A643B3F4640",
    "transport_method": "bicycle"
  },
  {
    "code": "user002",
    "position": "0101000020E6100000C976BE9F1AAF26408FC2F5285C3F4640",
    "transport_method": "car"
  },
  {
    "code": "user003",
    "position": "0101000020E6100000FED478E926B12640560E2DB29D3F4640",
    "transport_method": "walking"
  }
]
*/