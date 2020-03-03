FROM node:alpine
WORKDIR /usr/src/app
COPY package*.json ./
COPY moodle.js ./
COPY docker-service.js ./
COPY entrypoint.sh /usr/local/bin/

ENV PUID 1000
ENV PGID 1000

RUN apk add --no-cache sudo shadow && \
   npm install && \
   chmod +x /usr/local/bin/entrypoint.sh

VOLUME [ "/data" ]
ENTRYPOINT [ "entrypoint.sh" ]
CMD [ "node", "docker-service.js" ]
