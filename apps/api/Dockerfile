FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci
RUN npm run prisma:generate -w @family-finance/api
RUN npm run build -w @family-finance/api

ENV NODE_ENV=production
ENV API_PORT=4000

EXPOSE 4000

CMD ["sh", "-c", "npm run prisma:push -w @family-finance/api && npm run start -w @family-finance/api"]
