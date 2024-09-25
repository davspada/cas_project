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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));