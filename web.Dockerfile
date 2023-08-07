#Use the latest and greatest image
FROM node:18


# Use built in user 'node' but change the Group ID & User ID to what was defined
# in docker-compose.yml
ARG UID
ARG GID 
RUN groupmod -g ${GID} node && usermod -u ${UID} -g ${GID} node

# Create /code directory and give it to node.  Add everything there.
ADD . /code/
RUN chown -R node:node /code
WORKDIR /code
USER node

# Create SSL keys 
RUN openssl genrsa -out key.pem
RUN openssl req -new -key key.pem -out csr.pem -subj "/C=US/ST=OR/L=Portland/O=NestrisChamps/CN=nestrischamps.local"
RUN openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
RUN rm csr.pem



# the startup script expects a .env file to exist, an empty one works
# the necessary environment variables are set by the compose file
RUN touch .env

# Install dependencies
RUN npm install
