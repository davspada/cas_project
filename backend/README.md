To use the `backup.sql` type:

1- `docker cp backup.sql backend-postgis-1:/backup.sql`

2- `docker exec -it backend-postgis-1 psql -U postgis -d mydb -f /backup.sql`
