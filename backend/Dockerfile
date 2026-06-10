# Build stage — context is repo root
FROM node:26-alpine AS build
WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY backend/package.json ./backend/

# Install all workspace dependencies
RUN npm ci --workspaces

# Copy source
COPY packages/schemas/ ./packages/schemas/
COPY backend/ ./backend/

# Build schemas first (backend depends on it)
RUN npm run build -w @portlog/schemas

# Generate Prisma client
RUN cd backend && npx prisma generate

# Build backend
RUN npm run build -w @portlog/backend

# Production stage
FROM node:26-alpine AS runtime
WORKDIR /app

# Copy only what runtime needs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=build /app/packages/schemas/package.json ./packages/schemas/package.json

WORKDIR /app/backend
EXPOSE 3000

# In production, run migrations then start the server.
# prisma migrate deploy is idempotent — safe to run on every restart.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
