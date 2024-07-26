#!/bin/sh

if [[ -n $HTTPS ]]; then
    echo "Generating self signed cert"
    openssl req \
        -x509 \
        -newkey rsa:4096 \
        -keyout key.pem \
        -out cert.pem \
        -sha256 \
        -days 3650 \
        -nodes \
        -subj "/C=XX/ST=State/L=City/O=NTC/OU=NTC/CN=localhost"
    mv *.pem nestrischamps/
fi

docker-compose build nc --build-arg HTTPS=$HTTPS

if [[ -n $HTTPS ]]; then
    rm nestrischamps/*.pem
fi

docker create -ti --name cpsql nestrischamps bash
docker cp cpsql:/nestrischamps/setup/db.sql postgresql/
docker rm -f cpsql
docker-compose build db
rm postgresql/db.sql
