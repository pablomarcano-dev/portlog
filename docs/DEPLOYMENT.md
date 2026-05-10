# Portlog — Deployment Guide

> Production deployment, Docker setup, environment configuration, and operational checklist.
> Companion document to [STACK.md](./STACK.md).

---

## Architecture Overview

```
                    Internet
                       │
                       ▼
                  ┌─────────┐
                  │  Nginx  │ ← SSL termination (Certbot)
                  │ Reverse │
                  │  Proxy  │
                  └────┬────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │Frontend │   │Backend  │   │  MinIO  │
    │ (Nginx  │   │(NestJS) │   │ (S3 API)│
    │ static) │   │  :3000  │   │  :9000  │
    └─────────┘   └────┬────┘   └─────────┘
                       │
                       ▼
                  ┌─────────┐
                  │  Neon   │ ← External (managed Postgres)
                  │Postgres │
                  └─────────┘
```

The database is **external** (Neon) and not in `docker-compose.yml`. Everything else runs in containers on a single VPS.

---

## docker-compose.dev.yml (local development)

`docker-compose.dev.yml` brings up the local infrastructure dependencies: Postgres and MinIO. It does **not** build or run the backend or frontend — those run via `npm run dev` on the host.

```bash
docker compose -f docker-compose.dev.yml up -d
```

Services:

- `postgres` — Postgres 16-alpine on `:5432`. Credentials: `portlog` / `portlog_dev`. Health-checked.
- `minio` — MinIO on `:9000` (S3 API) and `:9001` (console). Credentials from `.env` or defaults `portlog` / `portlog_dev`. Health-checked via `/minio/health/live`.
- `minio-init` — One-shot container (`minio/mc`) that creates the `sgc-documents` bucket once MinIO is healthy. Exits 0 after bucket creation.

Connect to local Postgres:

```bash
psql postgresql://portlog:portlog_dev@localhost:5432/portlog
```

MinIO console: http://localhost:9001 (login: `portlog` / `portlog_dev`).

---

## docker-compose.yml

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    expose:
      - '80'
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    expose:
      - '3000'
    env_file:
      - .env
    depends_on:
      - minio
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    expose:
      - '9000'
      - '9001'
    volumes:
      - minio-data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    restart: unless-stopped

volumes:
  minio-data:
```

---

## Dockerfiles

### Frontend Dockerfile

Build context is the **repo root** (monorepo-aware). The Dockerfile lives at `frontend/Dockerfile`. `packages/schemas/` must be copied before `npm ci` so that `@portlog/schemas` resolves during `vite build`.

```dockerfile
# Build stage — context is repo root
FROM node:26-alpine AS build
WORKDIR /app

COPY package*.json ./
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
```

### Frontend nginx.conf

Includes gzip compression and SPA fallback routing. Lives at `frontend/nginx.conf`.

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long cache for hashed assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

### Backend Dockerfile

Build context is the **repo root** (monorepo-aware). The Dockerfile lives at `backend/Dockerfile`.

Both `backend` and `frontend` services in `docker-compose.yml` use `build.context: .` (repo root) so that `packages/schemas/` is reachable during the Docker build. The `dockerfile:` path is relative to that context.

```dockerfile
# Build stage — context is repo root
FROM node:26-alpine AS build
WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./
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
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=build /app/packages/schemas/package.json ./packages/schemas/package.json

WORKDIR /app/backend
EXPOSE 3000

# prisma migrate deploy is idempotent — only applies pending migrations.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

The migration runs on container start. Safe because Prisma migrations are idempotent and `migrate deploy` only applies pending migrations.

---

## Reverse Proxy Configuration

`nginx/conf.d/portlog.conf`:

```nginx
upstream backend {
    server backend:3000;
}

upstream frontend {
    server frontend:80;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name portlog.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name portlog.example.com;

    ssl_certificate /etc/letsencrypt/live/portlog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portlog.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    # API
    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # MinIO (S3 API) — internal-only path
    location /storage/ {
        proxy_pass http://minio:9000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
    }
}
```

---

## Environment Variables

`.env.example` (commit this; never commit `.env`):

```env
# === App ===
NODE_ENV=production
PORT=3000
APP_URL=https://portlog.example.com

# === Database (Neon) ===
DATABASE_URL=postgresql://user:pass@ep-xxxx-pooler.us-east-2.aws.neon.tech/portlog?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/portlog?sslmode=require

# === JWT ===
JWT_SECRET=                   # 256-bit random, generate with: openssl rand -base64 32
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=           # Different 256-bit random
JWT_REFRESH_EXPIRES_IN=7d

# === MinIO ===
MINIO_ROOT_USER=portlog
MINIO_ROOT_PASSWORD=          # Strong password
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=sgc-documents

# === AIS Provider ===
AIS_PROVIDER=marinetraffic   # marinetraffic | vesselfinder
AIS_API_KEY=

# === Email (SMTP) ===
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@portlog.example.com

# === WhatsApp ===
WHATSAPP_MODE=local           # local | twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# === Logging ===
LOG_LEVEL=info                # debug | info | warn | error
```

---

## Region Considerations

The backend container **must** run in the same region as the Neon project to minimize latency and egress costs. With Neon in `aws-us-east-2`:

| VPS Provider | Region to use                                          |
| ------------ | ------------------------------------------------------ |
| DigitalOcean | NYC3 or Ashburn                                        |
| Hetzner US   | Hillsboro (closest US-East proxy via internal network) |
| Linode       | Newark or Washington DC                                |
| Fly.io       | `iad`                                                  |
| Railway      | `us-east`                                              |

**Latency impact**: same-region <5ms vs cross-continent 150–200ms. For an app that issues 5–10 queries per page load, this is the difference between a snappy UI and a sluggish one.

---

## Initial Production Deployment

### 1. Server prerequisites

Ubuntu 22.04 LTS, 4GB RAM minimum, 50GB SSD:

```bash
# Install Docker + Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Clone and configure

```bash
git clone <repo-url> portlog
cd portlog
cp .env.example .env
# Fill in .env with production values
```

### 3. Initial SSL certificate

```bash
# Start Nginx without SSL first
docker compose up -d nginx

# Request certificate
docker compose run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d portlog.example.com \
  --email admin@example.com \
  --agree-tos --no-eff-email

# Restart Nginx with SSL config
docker compose restart nginx
```

### 4. Initialize MinIO bucket

In **development**, `docker-compose.dev.yml` includes a `minio-init` one-shot container (using the `minio/mc` image) that creates the `sgc-documents` bucket automatically once MinIO is healthy.

In **production**, run the bucket-create manually after MinIO is up:

```bash
docker compose up -d minio

docker run --rm --network portlog_default \
  -e MC_HOST_local="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  minio/mc mb --ignore-existing local/sgc-documents
```

Or interactively:

```bash
docker run --rm -it --network portlog_default minio/mc sh
mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
mc mb local/sgc-documents
exit
```

### 5. Bring up the full stack

```bash
docker compose up -d
docker compose logs -f backend  # Watch migration apply
```

---

## Production Checklist

Run through this list before declaring a production deploy complete:

- [ ] All `.env` secrets set with strong values (no defaults)
- [ ] JWT secrets are 256-bit random, distinct between access and refresh
- [ ] `NODE_ENV=production` on backend
- [ ] SSL certificate valid, auto-renewal cron tested
- [ ] Database connection uses pooler URL in `DATABASE_URL`
- [ ] Direct URL only used for migrations
- [ ] Neon restore window set to 7 days minimum
- [ ] MinIO root credentials rotated from defaults
- [ ] MinIO bucket policy is **not** public
- [ ] Firewall: only 22, 80, 443 open externally
- [ ] SSH: password auth disabled, key-only access
- [ ] Backend logs streaming to a log aggregator (or at minimum, persisted volume)
- [ ] Health check endpoint responding (`GET /api/health`)
- [ ] First user created via seed script with hashed password
- [ ] Client owners briefed on backup recovery procedure

---

## Backup Strategy

### Database

Neon's built-in PITR covers operational recovery (accidental delete, bad migration). For disaster recovery, run a weekly `pg_dump` to an off-platform location:

```bash
# On a cron job (separate machine or scheduled task)
pg_dump $DATABASE_URL_DIRECT \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=portlog-$(date +%Y%m%d).dump

# Upload to off-platform storage (B2, S3, or another provider)
```

### MinIO

Documents in `sgc-documents/` should be replicated to an off-server location weekly:

```bash
# Using rclone or aws s3 sync
mc mirror local/sgc-documents/ remote-backup/sgc-documents/
```

### Configuration

The `.env` file and any secrets are backed up **separately** from the codebase, in a password manager or secret store. Never commit `.env` to git.

---

## Disaster Recovery Procedure

If the server is destroyed:

1. Provision a new VPS in the same region
2. Install Docker
3. Clone the repository
4. Restore `.env` from the secret store
5. `docker compose up -d`
6. If MinIO data is lost, restore from off-platform mirror to `minio-data` volume
7. If Neon is intact (likely — it's external), the database is unaffected
8. If Neon is also lost, restore from latest `pg_dump` via `pg_restore`
9. DNS still points to old IP — update A record to new server
10. Test the full critical path: login → create nomination → generate SH-xx

**Target RTO**: 2 hours. **Target RPO**: 24 hours (last nightly backup).

---

## Monitoring & Alerts

Minimum viable monitoring:

- **Uptime check**: external HTTP probe to `/api/health` every 5 minutes
- **Disk usage**: alert when VPS disk > 80%
- **Backend logs**: alert on any `error` or `fatal` level entry
- **Failed login attempts**: alert if > 10 from same IP in 5 minutes
- **Neon compute hours**: weekly report; alert if trending toward plan limit

Recommended free/cheap options:

- UptimeRobot (free tier, HTTP checks)
- Better Stack / Logtail (free tier for low volume)
- Self-hosted Uptime Kuma if a separate small VPS is acceptable

---

## Updating Production

```bash
# On the server
cd /opt/portlog
git pull origin main
docker compose build
docker compose up -d
docker compose logs -f backend  # Watch for errors
```

Migration applies automatically via the backend container's startup command. If a migration fails, the backend container stays in a restart loop — investigate via logs before forcing.

For zero-downtime requirements (rare for an internal app of this size), see Blue-Green or rolling deploy patterns. Not justified for Portlog at current scale.
