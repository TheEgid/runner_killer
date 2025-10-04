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
echo "📦 Starting Prefect server..."
PYTHONWARNINGS="ignore" prefect server start --host 0.0.0.0 --port 4200 &
SERVER_PID=$!
echo "📌 Server PID: $SERVER_PID"

# Config
TIMEOUT=90
HEALTH_URL="http://localhost:4200/api/health"

# Auto-detect health check tool
if command -v curl >/dev/null 2>&1; then
    HEALTH_CMD="curl -f -s $HEALTH_URL >/dev/null 2>&1"
    echo "🔧 Using curl for health check"
elif command -v wget >/dev/null 2>&1; then
    HEALTH_CMD="wget --quiet --tries=1 --spider $HEALTH_URL >/dev/null 2>&1"
    echo "🔧 Using wget for health check"
else
    echo '❌ Neither curl nor wget found'
    exit 1
fi

# Однократная проверка готовности API
check_api_ready() {
    local timeout=$1
    local counter=0

    echo "⏳ Waiting for Prefect API (max ${timeout}s)..."

    while [ $counter -lt $timeout ]; do
        # Проверяем порт
        if command -v nc >/dev/null 2>&1; then
            nc -z localhost 4200 >/dev/null 2>&1
        else
            ss -tln | grep -q ":4200 " || netstat -tln 2>/dev/null | grep -q ":4200 "
        fi

        if [ $? -eq 0 ]; then
            # Порт открыт, проверяем API
            echo "📡 Port 4200 is open, checking API health..."
            if eval $HEALTH_CMD; then
                echo "✅ Prefect API ready after ${counter}s"
                return 0
            fi
        fi

        ((counter++))
        sleep 1
    done

    echo "❌ Prefect API did not respond after ${timeout}s"
    timeout 5 tail -n 20 /root/.prefect/prefect.log 2>/dev/null || echo "No logs available"
    return 1
}

# Проверка готовности CLI команд
check_cli_ready() {
    local timeout=$1
    local counter=0

    echo "⏳ Waiting for Prefect CLI commands (max ${timeout}s)..."

    while [ $counter -lt $timeout ]; do
        if prefect version >/dev/null 2>&1; then
            echo "✅ Prefect CLI ready after ${counter}s"
            return 0
        fi
        ((counter++))
        sleep 1
    done

    echo "❌ Prefect CLI did not respond after ${timeout}s"
    return 1
}

# Выполняем проверки
if ! check_api_ready $TIMEOUT; then
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
fi

# Дополнительная проверка для CLI команд
if ! check_cli_ready 30; then
    echo "⚠️ CLI not fully ready but continuing..."
fi

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

echo '⚡ Setting up concurrency limits...'
# Глобальный лимит concurrency
if prefect global-concurrency-limit ls 2>/dev/null | grep -q "my-global-limit"; then
    echo "✅ Global concurrency limit exists"
else
    if prefect global-concurrency-limit create "my-global-limit" --limit 5; then
        echo "✅ Global concurrency limit created"
    else
        echo "⚠️ Failed to create global concurrency limit"
    fi
fi

# Обновление лимита (если нужно изменить существующий)
if prefect global-concurrency-limit update "my-global-limit" --limit 5 --slot-decay-per-second 0.1 2>/dev/null; then
    echo "✅ Global concurrency limit updated"
else
    echo "⚠️ Failed to update global concurrency limit"
fi

# Лимит для work pool
if prefect work-pool set-concurrency-limit "default" 5 2>/dev/null; then
    echo "✅ Work pool concurrency limit set"
else
    echo "⚠️ Failed to set work pool concurrency limit"
fi

echo '🚀 Deploying flow and starting worker...'

# Запуск деплоя
echo "📤 Deploying flow..."
timeout 45 python main.py &
DEPLOY_PID=$!

# Запуск воркера
echo "👷 Starting worker..."
prefect worker start --pool default --type process &
WORKER_PID=$!

# Ждём деплой
if wait $DEPLOY_PID; then
    echo "✅ Flow deployed successfully"
else
    echo "⚠️ Flow deployment failed or timed out"
fi

# Проверка воркера
sleep 2
if ps -p $WORKER_PID >/dev/null 2>&1; then
    echo "✅ Worker started (PID $WORKER_PID)"
else
    echo "⚠️ Worker failed to start"
    WORKER_PID="N/A"
fi

echo "🎉 Prefect 3.x ready! (Server: $SERVER_PID, Worker: $WORKER_PID)"
echo "📊 API available at: http://localhost:4200"
echo "⚡ Concurrency limits: global=5, work-pool=5"

# Ожидание фоновых процессов
wait $SERVER_PID $WORKER_PID 2>/dev/null || true
echo "👋 Shutdown complete"
exit 0
