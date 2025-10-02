# ------------------------ Stage 1: Builder ------------------------
FROM node:23.10.0-bookworm-slim AS builder

# Установка curl
RUN apt-get update && apt-get install -y --no-install-recommends \
curl wget \
openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Node environment variables
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV PNPM_HOME=/root/.pnpm-store
ENV PATH=$PNPM_HOME:$PATH

# Копируем сначала только файлы зависимостей
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# Вариант 3: Huawei mirror
RUN pnpm config set registry https://repo.huaweicloud.com/repository/npm/

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile --prefer-offline

# Копируем весь код
COPY . .

# Генерация Prisma и сборка
RUN pnpm select-schema \
 && pnpm prisma generate --schema=./prisma/schema.prisma \
 && pnpm build

# ------------------------ Stage 2: Application ------------------------
FROM node:23.10.0-bookworm-slim AS application

# CURL
RUN apt-get update && apt-get install -y --no-install-recommends \
curl wget \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Set environment variables
ENV TZ='Europe/Moscow'
ENV NEXT_PUBLIC_BASE_PATH=/ui
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV PNPM_HOME=/root/.pnpm-store
ENV PATH=$PNPM_HOME:$PATH

# Copy built app from builder
COPY --from=builder /app /app

# Expose
EXPOSE 3006

# Start
CMD ["pnpm", "start"]
