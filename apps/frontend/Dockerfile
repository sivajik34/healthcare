FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json /usr/src/app/package.json
RUN npm install
COPY . /usr/src/app

EXPOSE 5173

CMD ["npm", "run", "dev"]


