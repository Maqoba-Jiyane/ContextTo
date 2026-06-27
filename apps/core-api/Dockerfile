FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/core-api/package*.json ./apps/core-api/
COPY apps/frontend/package*.json ./apps/frontend/

RUN npm ci

COPY apps/core-api ./apps/core-api

RUN mkdir -p ./apps/core-api/uploads/documents

ENV DATABASE_URL="postgresql://contexto:contexto_password@localhost:5432/contexto_db?schema=public"

RUN npm run prisma:generate -w apps/core-api
RUN npm run build -w apps/core-api

ENV NODE_ENV=production

WORKDIR /app/apps/core-api

EXPOSE 4000

CMD ["node", "dist/src/main.js"]