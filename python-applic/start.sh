#!/bin/bash
set -euo pipefail

# Единый обработчик сигналов (без реентерабельности)
shutting_down=false
graceful_shutdown() {
    if [ "$shutting_down" = true ]; then
        echo "🛑 Already shutting down..."
        exit 0
    fi
    shutting_down=true
    echo "SIGTERM received, shutting down gracefully..."
    kill 0 2>/dev/null || true
    wait 2>/dev/null || true
    exit 0
}
trap graceful_shutdown SIGTERM SIGINT

echo '🚀 Starting Prefect server (3.x)...'
cd /app
mkdir -p /root/.prefect

# Запуск сервера
prefect server start --host 0.0.0.0 --port 4200 &
SERVER_PID=$!

# Ускоренное ожидание API (60s вместо 120s)
echo '⏳ Waiting for Prefect API (max 60s)...'
for i in {1..60}; do
    if curl -f -s http://localhost:4200/api/health >/dev/null 2>&1; then
        echo "✅ API ready after ${i}s"
        break
    fi
    if [ $i -eq 60 ]; then
        echo '❌ Prefect server failed to start within 60s'
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Сразу после готовности API создаем work pool
echo '⚡ Ensuring default work pool...'
if prefect work-pool ls 2>/dev/null | grep -q "default"; then
    echo "✅ Default work pool exists"
else
    if prefect work-pool create "default" --type process; then
        echo "✅ Default work pool created"
    else
        echo '❌ Failed to create work pool'
        exit 1
    fi
fi

# Параллельный запуск деплоя и воркера
echo '🚀 Deploying flow and starting worker...'

# Запускаем деплой в фоне
timeout 45 python main.py &
DEPLOY_PID=$!

# И сразу запускаем воркера
prefect worker start --pool default --type process &
WORKER_PID=$!

# Ждем завершения деплоя
if wait $DEPLOY_PID; then
    echo "✅ Flow deployed successfully"
else
    echo "⚠️ Flow deployment had issues"
fi

# Быстрая проверка воркера
sleep 2
if ps -p $WORKER_PID >/dev/null 2>&1; then
    echo "✅ Worker started (PID $WORKER_PID)"
else
    echo "⚠️ Worker failed to start"
    WORKER_PID="N/A"
fi

echo "✅ Prefect 3.x ready! (Server: $SERVER_PID, Worker: $WORKER_PID)"

# Основное ожидание
wait $SERVER_PID $WORKER_PID 2>/dev/null || true
exit 0
