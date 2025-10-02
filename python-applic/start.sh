#!/bin/bash
set -uo pipefail

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
cd /app || { echo "❌ Failed to cd into /app"; exit 1; }
mkdir -p /root/.prefect

# Запуск сервера
PYTHONWARNINGS="ignore" prefect server start --host 0.0.0.0 --port 4200 &
SERVER_PID=$!
echo "📌 Server PID: $SERVER_PID"

echo '⏳ Initial server startup (15s)...'
sleep 15

# Config
TIMEOUT=90
HEALTH_URL="http://localhost:4200/api/health"
TOOL="wget"

# Auto-detect tool
if command -v curl >/dev/null 2>&1; then
    TOOL="curl"
    echo "Using curl for health check"
elif command -v wget >/dev/null 2>&1; then
    TOOL="wget"
    echo "Using wget for health check"
else
    echo '❌ Neither curl nor wget found'
    exit 1
fi

# Проверка порта
check_port() {
    if command -v nc >/dev/null 2>&1; then
        nc -z localhost 4200 >/dev/null 2>&1
    else
        ss -tln | grep -q ":4200 " || netstat -tln 2>/dev/null | grep -q ":4200 "
    fi
}

# Проверка API (упрощённая, как у тебя работало раньше)
check_health() {
    if [ "$TOOL" = "curl" ]; then
        curl -f -s "$HEALTH_URL" >/dev/null 2>&1
    else
        wget --quiet --tries=1 --spider "$HEALTH_URL" >/dev/null 2>&1
    fi
}

echo "⏳ Waiting for Prefect API (max ${TIMEOUT}s)..."
for i in $(seq 1 $TIMEOUT); do
    if ! check_port; then
        echo "⚠️ [$i] Port 4200 not ready yet..."
        sleep 1
        continue
    fi
    if check_health; then
        echo "✅ Prefect API ready after ${i}s"
        break
    fi
    if [ "$i" -eq "$TIMEOUT" ]; then
        echo "❌ Prefect API did not respond after ${TIMEOUT}s"
        timeout 5 tail -n 20 /root/.prefect/prefect.log 2>/dev/null || echo "No logs available"
        kill "$SERVER_PID" 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

echo '⚡ Ensuring default work pool...'
if prefect work-pool ls 2>/dev/null | grep -q "default"; then
    echo "✅ Default work pool exists"
else
    if prefect work-pool create "default" --type process; then
        echo "✅ Default work pool created"
    else
        echo "❌ Failed to create work pool"
    fi
fi

echo '🚀 Deploying flow and starting worker...'

# Запуск деплоя
timeout 45 python main.py &
DEPLOY_PID=$!

# Запуск воркера
prefect worker start --pool default --type process &
WORKER_PID=$!

# Ждём деплой
if wait $DEPLOY_PID; then
    echo "✅ Flow deployed successfully"
else
    echo "⚠️ Flow deployment failed (PID $DEPLOY_PID)"
fi

# Проверка воркера
sleep 2
if ps -p $WORKER_PID >/dev/null 2>&1; then
    echo "✅ Worker started (PID $WORKER_PID)"
else
    echo "⚠️ Worker failed to start"
    WORKER_PID="N/A"
fi

echo "✅ Prefect 3.x ready! (Server: $SERVER_PID, Worker: $WORKER_PID)"

# Ожидание фоновых процессов
wait $SERVER_PID $WORKER_PID 2>/dev/null || true
exit 0
