FROM node:24-alpine

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:4000/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci
RUN npm run build -w @family-finance/web

EXPOSE 4173

CMD ["npm", "run", "preview", "-w", "@family-finance/web", "--", "--host", "0.0.0.0", "--port", "4173"]
