# SALESDOC API — Railway / Docker (Fastify + Prisma)
# ─── Stage 1: Builder ────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

ENV DATABASE_URL="postgresql://buildtime:buildtime@127.0.0.1:5432/buildtime?schema=public"

RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY src ./src
COPY shared ./shared

RUN npx prisma generate && npx tsc -p tsconfig.json
RUN test -f dist/src/index.js

# ─── Stage 2: Production ─────────────────────────────────────
FROM node:22-bookworm-slim AS production

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

ENV DATABASE_URL="postgresql://buildtime:buildtime@127.0.0.1:5432/buildtime?schema=public"

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY shared ./shared
COPY scripts/docker-start.sh ./scripts/docker-start.sh
RUN chmod +x scripts/docker-start.sh

ENV NODE_ENV=production

EXPOSE 4000

CMD ["./scripts/docker-start.sh"]
