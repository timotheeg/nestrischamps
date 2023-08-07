#Use the latest and greatest image
FROM postgres:latest

# Use built in user 'postgres' but change the Group ID & User ID to what was defined
# in docker-compose.yml
ARG UID
ARG GID 
RUN groupmod -g ${GID} postgres && usermod -u ${UID} -g ${GID} postgres
USER postgres

# Create startup dir if necessary and copy setup script for db initialization
# The setup script will not run if db has already been initialized

RUN mkdir -p /docker-entrypoint-initdb.d
COPY ./setup/db.sql /docker-entrypoint-initdb.d


