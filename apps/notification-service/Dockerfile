FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json /usr/src/app/package.json
RUN npm install --omit=dev
COPY server.js /usr/src/app/server.js

ENV PORT=9001
EXPOSE 9001

CMD ["npm", "start"]


