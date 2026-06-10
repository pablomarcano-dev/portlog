# Build stage — context is repo root
FROM node:26-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY frontend/package.json ./frontend/

RUN npm ci --workspaces

COPY packages/schemas/ ./packages/schemas/
COPY frontend/ ./frontend/

RUN npm run build -w @portlog/schemas
RUN npm run build -w @portlog/frontend

# Production stage
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
