FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

RUN npm install

COPY shared/ ./shared/
COPY server/ ./server/

RUN npm run build --workspace=shared
RUN cd server && npx prisma generate
RUN npm run build --workspace=server

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema=server/prisma/schema.prisma && node server/dist/index.js"]