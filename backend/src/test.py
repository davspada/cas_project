import asyncio
import asyncpg
import json

# GeoJSON di esempio contenente il poligono
geojson_polygon = {
    "type": "Polygon",
    "coordinates": [
        [
            [12.492, 41.890],
            [12.493, 41.890],
            [12.493, 41.891],
            [12.492, 41.891],
            [12.492, 41.890]  # L'ultimo punto chiude il poligono
        ]
    ]
}

async def fetch_geodata():
    # Connessione al database
    conn = await asyncpg.connect(
        user='postgis',
        password='password',
        database='mydb',
        host='localhost',  # Cambia con il tuo host
        port='5432'        # Porta di default per PostgreSQL
    )

    # Converti il poligono GeoJSON in una stringa
    geofence_geojson = json.dumps(geojson_polygon)

    # Query per trovare i punti all'interno del poligono
    query_inside = """
    SELECT code
    FROM users
    WHERE ST_Within(position, ST_GeomFromGeoJSON($1));
    """

    # Query per trovare i punti entro 1 km dal geofence
    query_within_1km = """
    SELECT code
    FROM users
    WHERE ST_DWithin(position, ST_GeomFromGeoJSON($1), 1000)
        AND NOT ST_Within(position, ST_GeomFromGeoJSON($1));
    """

    # Query per trovare i punti tra 1 e 2 km dal geofence
    query_1_to_2km = """
    SELECT code
    FROM users
    WHERE ST_DWithin(position, ST_GeomFromGeoJSON($1), 2000)
      AND NOT ST_DWithin(position, ST_GeomFromGeoJSON($1), 1000);
    """

    inside = await conn.fetch(query_inside, geofence_geojson)
    # Stampa i risultati in maniera leggibile
    print("Punti all'interno del poligono:")
    for point in inside:
        print(point)

    in_1km = await conn.fetch(query_within_1km, geofence_geojson)
    print("Punti entro 1 km:")
    for point in in_1km:
        print(point)

    in_2km = await conn.fetch(query_1_to_2km, geofence_geojson)
    print("Punti tra 1 e 2 km:")
    for point in in_2km:
        print(point)

    # Chiudi la connessione
    await conn.close()

# Esegui la funzione asincrona
asyncio.run(fetch_geodata())
