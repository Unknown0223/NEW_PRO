# Telegram client-intake bot — Railway (long polling, always-on)
FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci && npx tsc -p tsconfig.json && test -f dist/index.js

FROM node:22-bookworm-slim AS production

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV TZ=Asia/Tashkent

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
