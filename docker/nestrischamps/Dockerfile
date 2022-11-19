# syntax=docker/dockerfile:1
FROM node:18-alpine
RUN apk add git
RUN git clone https://github.com/timotheeg/nestrischamps.git
WORKDIR ./nestrischamps
RUN npm ci
CMD [ "npm", "run", "start" ]
