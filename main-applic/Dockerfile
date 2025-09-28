# ------------------------ Stage 1: Builder ------------------------
FROM node:23.10.0-bookworm-slim AS builder

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
  curl \
  openssl \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

WORKDIR /app

# Corepack для pnpm
RUN corepack enable

# Настройки окружения
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# pnpm всегда тянет зависимости через Verdaccio
ENV NPM_CONFIG_REGISTRY=http://verdaccio:4873
ENV PNPM_HOME=/root/.pnpm-store
ENV PATH=$PNPM_HOME:$PATH

# Copy deps
COPY package.json pnpm-lock.yaml ./

# Сначала install, потом update через verdaccio
RUN --mount=type=cache,target=/root/.pnpm-store \
  pnpm install --frozen-lockfile --prefer-offline \
  && pnpm update --latest

# Copy code (включая .env если dev; добавьте COPY .env . если нужно)
COPY . .

# Select schema (с fallback)
RUN pnpm select-schema

# Generate Prisma (explicit schema path)
RUN pnpm prisma generate --schema=./prisma/schema.prisma

# Build
RUN pnpm build

# ------------------------ Stage 2: Application ------------------------
FROM node:23.10.0-bookworm-slim AS application

RUN apt-get update && apt-get install -y \
  curl \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

WORKDIR /app

RUN corepack enable

# 👇 registry и pnpm cache доступны и в рантайме
ENV TZ='Europe/Moscow'
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV NPM_CONFIG_REGISTRY=http://verdaccio:4873
ENV PNPM_HOME=/root/.pnpm-store
ENV PATH=$PNPM_HOME:$PATH

COPY --from=builder /app /app

EXPOSE 3006

CMD ["pnpm", "start"]
