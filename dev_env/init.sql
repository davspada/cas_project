-- Create the users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10), --NOT NULL
    token VARCHAR,
    connected BOOLEAN NOT NULL DEFAULT FALSE,
    location GEOMETRY(Point, 4326),
    transportation_mode VARCHAR(10) CHECK (transportation_mode IN ('car', 'walking'))
);

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    geofence GEOMETRY(Polygon, 4326),
    time_start timestamp without time zone NOT NULL,
    time_end timestamp without time zone,
    description text
);
-- Insert sample users with location in Bologna, Italy
INSERT INTO users (location, transportation_mode)
VALUES
    (ST_SetSRID(ST_MakePoint(11.3426, 44.4949), 4326), 'walking'), -- User 1
    (ST_SetSRID(ST_MakePoint(11.3430, 44.4955), 4326), 'walking'), -- User 2
    (ST_SetSRID(ST_MakePoint(11.3440, 44.4960), 4326), 'walking'), -- User 3
    (ST_SetSRID(ST_MakePoint(11.3450, 44.4970), 4326), 'car'),     -- User 4
    (ST_SetSRID(ST_MakePoint(11.3460, 44.4980), 4326), 'car'),     -- User 5
    (ST_SetSRID(ST_MakePoint(11.3470, 44.4990), 4326), 'walking'), -- User 6
    (ST_SetSRID(ST_MakePoint(11.3480, 44.5000), 4326), 'car'),     -- User 7
    (ST_SetSRID(ST_MakePoint(11.3490, 44.5010), 4326), 'walking'), -- User 8
    (ST_SetSRID(ST_MakePoint(11.3500, 44.5020), 4326), 'car'),     -- User 9
    (ST_SetSRID(ST_MakePoint(11.3510, 44.5030), 4326), 'walking'), -- User 10
    (ST_SetSRID(ST_MakePoint(11.3520, 44.5040), 4326), 'car'),     -- User 11
    (ST_SetSRID(ST_MakePoint(11.3530, 44.5050), 4326), 'walking'), -- User 12
    (ST_SetSRID(ST_MakePoint(11.3540, 44.5060), 4326), 'car'),     -- User 13
    (ST_SetSRID(ST_MakePoint(11.3550, 44.5070), 4326), 'walking'), -- User 14
    (ST_SetSRID(ST_MakePoint(11.3560, 44.5080), 4326), 'car'),     -- User 15
    (ST_SetSRID(ST_MakePoint(11.3570, 44.5090), 4326), 'walking'), -- User 16
    (ST_SetSRID(ST_MakePoint(11.3580, 44.5100), 4326), 'car'),     -- User 17
    (ST_SetSRID(ST_MakePoint(11.3590, 44.5110), 4326), 'walking'), -- User 18
    (ST_SetSRID(ST_MakePoint(11.3600, 44.5120), 4326), 'car'),     -- User 19
    (ST_SetSRID(ST_MakePoint(11.3610, 44.5130), 4326), 'walking'); -- User 20

    -- Insert sample alerts with geofence in Bologna, Italy
    INSERT INTO alerts (geofence, time_start, time_end, description)
    VALUES
        (ST_SetSRID(ST_GeomFromText('POLYGON((11.3400 44.4900, 11.3400 44.5000, 11.3500 44.5000, 11.3500 44.4900, 11.3400 44.4900))'), 4326), '2023-10-01 08:00:00', '2023-10-01 18:00:00', 'Polygon alert in Bologna'),
        (ST_Buffer(ST_SetSRID(ST_MakePoint(11.3426, 44.4949), 4326), 0.01), '2023-10-02 09:00:00', '2023-10-02 17:00:00', 'Circular alert in Bologna');