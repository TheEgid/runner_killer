# ------------------------ Stage 1: Builder ------------------------
FROM node:23.10.0-bookworm-slim AS builder

# Установка системных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
curl \
openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Corepack для pnpm
RUN corepack enable

# Настройки окружения
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV PNPM_HOME=/root/.pnpm-store
ENV PATH=$PNPM_HOME:$PATH

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,target=/root/.pnpm-store \
pnpm install --frozen-lockfile --prefer-offline

# Копируем весь код
COPY . .


RUN pnpm select-schema \
 && pnpm prisma generate --schema=./prisma/schema.prisma \
 && pnpm build

# ------------------------ Stage 2: Application ------------------------
FROM node:23.10.0-bookworm-slim AS application

RUN apt-get update && apt-get install -y --no-install-recommends \
curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

ENV TZ='Europe/Moscow'
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV PNPM_HOME=/root/.pnpm-store
ENV PATH=$PNPM_HOME:$PATH

COPY --from=builder /app /app

EXPOSE 3006

# Стандартный запуск Next.js
CMD ["pnpm", "start"]
