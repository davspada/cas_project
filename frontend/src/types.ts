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
  