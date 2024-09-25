-- Create the users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    location GEOMETRY(Point, 4326),
    transportation_mode VARCHAR(10) CHECK (transportation_mode IN ('car', 'walking'))
);

-- Insert sample users with location in Bologna, Italy
INSERT INTO users (location, transportation_mode)
VALUES
    (ST_SetSRID(ST_MakePoint(11.3426, 44.4949), 4326), 'walking'), -- User 1
    (ST_SetSRID(ST_MakePoint(11.3428, 44.4935), 4326), 'walking'), -- User 2
    (ST_SetSRID(ST_MakePoint(11.3421, 44.4957), 4326), 'walking'), -- User 3
    (ST_SetSRID(ST_MakePoint(11.3430, 44.4960), 4326), 'car'),     -- User 4
    (ST_SetSRID(ST_MakePoint(11.3432, 44.4970), 4326), 'car');     -- User 5