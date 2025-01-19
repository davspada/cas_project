-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create USERS table
CREATE TABLE USERS (
    id SERIAL PRIMARY KEY,
    code varchar(50) UNIQUE NOT NULL,
    "token" varchar(50) UNIQUE NOT NULL,
    connected boolean NOT NULL,
    position public.geometry,
    transport_method varchar(50)
);

-- Create ALERTS table
CREATE TABLE ALERTS (
    id SERIAL PRIMARY KEY,
    geofence public.geometry UNIQUE NOT NULL,
    time_start timestamp NOT NULL,
    time_end timestamp,
    description text NOT NULL
);

-- Create index for geospatial queries
CREATE INDEX idx_users_position ON users USING GIST(position);
CREATE INDEX idx_alerts_geofence ON alerts USING GIST(geofence);

-- Insert sample data into USERS
INSERT INTO USERS (code, token, connected, position, transport_method)
VALUES
    ('user001', 'token1234', true, ST_GeomFromText('POINT(11.343 44.494)', 4326), 'bicycle'),
    ('user002', 'token5678', true, ST_GeomFromText('POINT(11.342 44.495)', 4326), 'car'),
    ('user003', 'token9101', true, ST_GeomFromText('POINT(11.346 44.497)', 4326), 'walking'),
    ('user004', 'token1121', false, ST_GeomFromText('POINT(11.345 44.493)', 4326), 'bus'),
    ('user005', 'token3141', false, ST_GeomFromText('POINT(11.348 44.496)', 4326), 'scooter');

-- Insert sample data into ALERTS
INSERT INTO ALERTS (geofence, time_start, time_end, description)
VALUES
    (ST_GeomFromText('POLYGON((10 10, 20 10, 20 20, 10 20, 10 10))', 4326), 
    '2024-11-26 08:30:00', NULL, 'High alert in zone A'),
    (ST_GeomFromText('POLYGON((30 30, 40 30, 40 40, 30 40, 30 30))', 4326), 
    '2024-11-26 12:00:00', NULL, 'Roadblock in zone B'),
    (ST_GeomFromText('POLYGON((50 50, 60 50, 60 60, 50 60, 50 50))', 4326), 
    '2024-11-27 09:00:00', '2024-12-27 09:00:00', 'Maintenance alert in zone C'),
    (ST_GeomFromText('POLYGON((70 70, 80 70, 80 80, 70 80, 70 70))', 4326), 
    '2024-11-25 07:00:00', '2024-11-25 19:00:00', 'Event completed in zone D'),
    (ST_GeomFromText('POLYGON((90 90, 100 90, 100 100, 90 100, 90 90))', 4326), 
    '2024-11-24 10:00:00', '2024-11-24 22:00:00', 'Event completed in zone E');