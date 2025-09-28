#!/usr/bin/env bash
set -e

PGDATA=${PGDATA:-/var/lib/postgresql/data}

echo "Настройка логирования SQL-запросов PostgreSQL..."

# Проверяем, что конфиг существует
if [ ! -f "$PGDATA/postgresql.conf" ]; then
	echo "Ошибка: $PGDATA/postgresql.conf не найден"
	exit 1
fi

grep -q "^log_destination" "$PGDATA/postgresql.conf" && \
	sed -i "s/^log_destination.*/log_destination = 'stderr'/" "$PGDATA/postgresql.conf" || \
	echo "log_destination = 'stderr'" >> "$PGDATA/postgresql.conf"

grep -q "^logging_collector" "$PGDATA/postgresql.conf" && \
	sed -i "s/^logging_collector.*/logging_collector = off/" "$PGDATA/postgresql.conf" || \
	echo "logging_collector = off" >> "$PGDATA/postgresql.conf"

grep -q "^log_statement" "$PGDATA/postgresql.conf" && \
	sed -i "s/^log_statement.*/log_statement = 'all'/" "$PGDATA/postgresql.conf" || \
	echo "log_statement = 'all'" >> "$PGDATA/postgresql.conf"

grep -q "^log_line_prefix" "$PGDATA/postgresql.conf" && \
	sed -i "s/^log_line_prefix.*/log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d '/" "$PGDATA/postgresql.conf" || \
	echo "log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d '" >> "$PGDATA/postgresql.conf"

# Отключаем логирование подключений и отключений
grep -q "^log_connections" "$PGDATA/postgresql.conf" && \
	sed -i "s/^log_connections.*/log_connections = off/" "$PGDATA/postgresql.conf" || \
	echo "log_connections = off" >> "$PGDATA/postgresql.conf"

grep -q "^log_disconnections" "$PGDATA/postgresql.conf" && \
	sed -i "s/^log_disconnections.*/log_disconnections = off/" "$PGDATA/postgresql.conf" || \
	echo "log_disconnections = off" >> "$PGDATA/postgresql.conf"

echo "Логирование SQL-запросов настроено."
