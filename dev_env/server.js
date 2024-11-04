// server.js or an API route file
const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const app = express();

app.use(cors());
// PostgreSQL client setup
const client = new Client({
    host: "cas-db",
    port: 5432,
    user: "cas",
    password: "pw",
    database: "cas_db",
});

client.connect();

app.get('/api/users', async (req, res) => {
  try {
    const result = await client.query(`
      SELECT 
        id, 
        ST_AsGeoJSON(location) as location,
        transportation_mode
      FROM users;
    `);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        geometry: JSON.parse(row.location),
        properties: { id: row.id , transportation_mode: row.transportation_mode },
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/api/alerts', async (req, res) => {
  try {
    const result = await client.query(`
      SELECT 
        id, 
        ST_AsGeoJSON(geofence) as geofence,
        time_start,
        time_end,
        description
      FROM alerts;
    `);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        geometry: JSON.parse(row.geofence),
        properties: { id: row.id, time_start: row.time_start, time_end: row.time_end, description: row.description },
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/alerts', async (req, res) => {
  const { geofence, time_start, time_end, description } = req.body;

  try {
    const result = await client.query(`
      INSERT INTO alerts (geofence, time_start, time_end, description)
      VALUES (ST_GeomFromGeoJSON($1), $2, $3, $4)
      RETURNING id;
    `, [JSON.stringify(geofence), time_start, time_end, description]);

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));