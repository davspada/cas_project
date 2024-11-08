import asyncio
import asyncpg
import json

# GeoJSON di esempio contenente il poligono
geojson_polygon = {
    "type": "Polygon",
    "coordinates": [
        [
            [44.49802297820631, 11.331881564630335],
            [44.495448901760554, 11.330167415089697],
            [44.49435488486275, 11.336410528153502],
            [44.498434819892545, 11.338142721372963],
            [44.49802297820631, 11.331881564630335]
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
    SELECT 
        code,
        ST_Distance(
            ST_Transform(position, 3857), 
            ST_Transform(ST_GeomFromGeoJSON($1), 3857)
        ) AS distance_meters
    FROM users
    WHERE ST_DWithin(ST_Transform(position, 3857), ST_Transform(ST_GeomFromGeoJSON($1), 3857), 1000)
        AND NOT ST_Within(position, ST_GeomFromGeoJSON($1));
    """

    # Query per trovare i punti tra 1 e 2 km dal geofence
    query_1_to_2km = """
    SELECT 
        code,
        ST_Distance(
            ST_Transform(position, 3857), 
            ST_Transform(ST_GeomFromGeoJSON($1), 3857)
        ) AS distance_meters
    FROM users
    WHERE ST_DWithin(ST_Transform(position, 3857), ST_Transform(ST_GeomFromGeoJSON($1), 3857), 2000)
      AND NOT ST_DWithin(ST_Transform(position, 3857), ST_Transform(ST_GeomFromGeoJSON($1), 3857), 1000);
    """

    query_over_2km = """
    SELECT
        code,
        ST_Distance(
            ST_Transform(position, 3857),
            ST_Transform(ST_GeomFromGeoJSON($1), 3857)
        ) AS distance_meters
    FROM users
    WHERE NOT ST_DWithin(ST_Transform(position, 3857), ST_Transform(ST_GeomFromGeoJSON($1), 3857), 2000);
    """

    inside = await conn.fetch(query_inside, geofence_geojson)
    # Stampa i risultati in maniera leggibile
    print("Punti all'interno del poligono:")
    # Print only the code, not all the string <Record code='ABC123'>
    for point in inside:
        print(point['code'])

    in_1km = await conn.fetch(query_within_1km, geofence_geojson)
    print("Punti entro 1 km:")
    for point in in_1km:
        print(point)

    in_2km = await conn.fetch(query_1_to_2km, geofence_geojson)
    print("Punti tra 1 e 2 km:")
    for point in in_2km:
        print(point)

    over_2km = await conn.fetch(query_over_2km, geofence_geojson)
    print("Punti oltre 2 km:")
    for point in over_2km:
        print(point)

    # Chiudi la connessione
    await conn.close()

# Esegui la funzione asincrona
asyncio.run(fetch_geodata())
