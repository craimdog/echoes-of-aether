FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

RUN npm install

COPY shared/ ./shared/
COPY server/ ./server/

RUN npm run build --workspace=shared
RUN npm run build --workspace=server

EXPOSE 3001
CMD ["node", "server/dist/index.js"]