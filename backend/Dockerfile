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

# Chromium for headless PDF rendering (puppeteer-core — no bundled browser).
# tzdata ships /usr/share/zoneinfo, which node:alpine omits — see the TZ note below.
RUN apk add --no-cache chromium tzdata
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Operating timezone. LOAD-BEARING — do not remove.
#
# Notice/SOF/NOR formatters render dates with the process-local getHours()/getDate()/
# getMonth(). With no TZ the process runs in UTC and every generated document is shifted
# +4h against the agency's actual local time (an ETA keyed as 16:00 printed as "20:00 hrs
# LT"), which can also roll the date across midnight. These are legally binding port
# documents, so the container must run on the agency's clock.
#
# Baked here so the image is correct even if the compose `environment:` block is dropped;
# docker-compose.yml sets it explicitly too. Overridable at runtime if the agency moves.
#
# Node and Chromium would resolve "America/Caracas" from their bundled ICU data even
# without tzdata, but the tzdata package is still installed above so that `date`, the
# shell, and any child process agree with Node — otherwise `docker compose exec backend
# date` reports UTC and misleads whoever is debugging a timestamp complaint.
ENV TZ=America/Caracas

# Copy only what runtime needs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/templates ./backend/templates
COPY --from=build /app/backend/src/pdf/templates ./backend/dist/pdf/templates
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=build /app/backend/tsconfig.seed.json ./backend/tsconfig.seed.json
COPY --from=build /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=build /app/packages/schemas/package.json ./packages/schemas/package.json

WORKDIR /app/backend

# Run as an unprivileged user. Any RCE in the Node process — a bad dependency, a
# Chromium escape while rendering a PDF — otherwise starts as root.
#
# The alpine base already ships a `node` user (uid 1000). Ownership is handed to
# it because both startup paths write: `prisma migrate deploy` needs a writable
# prisma directory for its engine, and Puppeteer writes scratch files while
# rendering. `npx` also wants a writable HOME, hence the explicit setting —
# without it npm falls back to / and the migration step fails at boot rather
# than at build.
RUN chown -R node:node /app
ENV HOME=/home/node
USER node

EXPOSE 3000

# In production, run migrations then start the server.
# prisma migrate deploy is idempotent — safe to run on every restart.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
