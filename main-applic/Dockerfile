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

# ENV
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy deps
COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,target=/root/.pnpm-store \
pnpm install --frozen-lockfile --prefer-offline

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

COPY --from=builder /app /app

EXPOSE 3006

ENV TZ='Europe/Moscow'
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

CMD ["pnpm", "start"]
