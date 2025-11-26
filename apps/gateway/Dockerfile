FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json /usr/src/app/package.json
RUN npm install --omit=dev
COPY server.js /usr/src/app/server.js
COPY route-config.json /usr/src/app/route-config.json

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]


