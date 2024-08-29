-- Create the users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    location GEOMETRY(Point, 4326)
);

-- Insert sample users with location in Bologna, Italy
INSERT INTO users (location)
VALUES
    (ST_SetSRID(ST_MakePoint(11.3426, 44.4949), 4326)), -- User 1
    (ST_SetSRID(ST_MakePoint(11.3428, 44.4935), 4326)), -- User 2
    (ST_SetSRID(ST_MakePoint(11.3421, 44.4957), 4326)); -- User 3