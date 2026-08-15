# SALESDOC panel — Railway / Docker (Next.js 14)
# Build context: frontend/ (vendor/pivot-engine deploy oldidan sync qilinadi)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG API_INTERNAL_ORIGIN
ENV API_INTERNAL_ORIGIN=${API_INTERNAL_ORIGIN}

COPY package.json package-lock.json ./
COPY vendor/pivot-engine ./vendor/pivot-engine
RUN test -f vendor/pivot-engine/dist/index.js
RUN npm ci
RUN test -e node_modules/@salec/pivot-engine/package.json \
  && test -f node_modules/@salec/pivot-engine/dist/index.js

COPY . .
# COPY . . vendor ni qayta yozishi mumkin — npm linkni yangilash
RUN npm install --ignore-scripts --no-save ./vendor/pivot-engine \
  && test -f node_modules/@salec/pivot-engine/dist/index.js

RUN npx next build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

EXPOSE 3000

CMD ["npm", "run", "start"]
