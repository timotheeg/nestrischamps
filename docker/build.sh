#!/bin/sh
docker-compose build nc
docker create -ti --name cpsql nestrischamps bash
docker cp cpsql:/nestrischamps/setup/db.sql postgresql/
docker rm -f cpsql
docker-compose build db
rm postgresql/db.sql
