# Stage 1: Build stage
FROM node:24-slim AS builder

WORKDIR /app

# Copy package manifests for workspace installation
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY shared/package.json shared/

# Install dependencies for build
RUN npm ci

# Copy source files
COPY tsconfig.base.json ./
COPY shared shared/
COPY web web/
COPY server server/

# Build Web SPA (Vite) and Server (TypeScript compilation)
RUN npm run build

# Stage 2: Production runner stage
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# Copy workspace package files
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY shared/package.json shared/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built Web dist and compiled Server dist + shared schemas
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/server/dist ./server/dist
COPY shared shared/

# Create volume directory owned by node user
RUN mkdir -p /data && chown -R node:node /data /app

USER node

EXPOSE 3000

# Container health check hitting unauthenticated /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server/dist/index.js"]
