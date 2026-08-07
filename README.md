# H0M3P4G3

Self-hosted, single-user responsive start page built with React 19, Hono 4, Node 24, and Tailwind CSS 4.

## Features

- **Authenticated & Private**: Password + TOTP authenticator validation with 30-day sliding HMAC-signed session cookies and rate-limiting.
- **Responsive Design**: Auto-reflowing grid (3 columns desktop, 2 columns tablet, 1 column mobile).
- **Atomic File Persistence**: Durably persists layout to `/data/layout.json` with zero database dependencies.
- **Single Container**: Single lightweight Node container serving both the SPA static bundle and `/api/*` routes.

## Local Development

```bash
# Install dependencies
npm install

# Run dev mode (Vite dev server + Hono API server)
npm run dev

# Run unit and integration tests
npm test

# Production build test
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` in development:

- `PORT`: Server port (default `3000`).
- `DATA_DIR`: Volume path for layout persistence (default `/data` in prod, `./data` in dev).
- `PASSWORD_HASH`: Bcrypt hash of owner password.
- `TOTP_SECRET`: Base32 secret for TOTP authenticator verification (min 16 bytes).
- `SESSION_SECRET`: Secret key used for signing session cookies.
- `RAINDROP_TOKEN`: Access token for Raindrop.io API integration.

## Production Deployment (VPS + Caddy)

### 1. Docker Compose Setup

On your VPS, clone the repository and configure environment variables in `.env`:

```bash
cp .env.example .env
# Fill in production values for PASSWORD_HASH, TOTP_SECRET, SESSION_SECRET, etc.
```

Build and launch the container:

```bash
docker compose up -d --build
```

The container runs on `127.0.0.1:3000` with an active healthcheck at `/api/health`.

### 2. Caddy Reverse Proxy Configuration

Add the following site block to your host `/etc/caddy/Caddyfile`:

```caddy
start.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

### Operator Actions

#### Revoking All Active Sessions

To force all active client sessions to log out immediately across all devices, rotate the `SESSION_SECRET` environment variable in `.env` and restart the container:

```bash
# Update SESSION_SECRET in .env
docker compose up -d --force-recreate
```