include ./.env
export

COMPOSE_BAKE=true

LANG=ru_RU.UTF-8


all: run clean


run:
	@docker compose build
# @docker buildx bake prefect-applic --no-cache
# @docker buildx bake main-applic --no-cache
	@docker compose up -d
	@docker ps

run_only:
	@docker compose up -d --quiet-pull

runner:
	@docker compose up


stop:
	@docker compose down


clean:
	@docker system prune -f
	@docker system prune -f --volumes


logs:
	@sudo htpasswd -b .htpasswd $(ADMIN_USER) $(ADMIN_PASSW)
	@goaccess ./log/nginx/access.log -o ./log/report/report.html --log-format COMBINED --html-report-title "Статистика"


test:
	@echo "jest tests will start after 3 seconds..."
	@sleep 3
	@docker exec -it main-applic_container pnpm test


up:
	@sudo dnf --refresh update && sudo dnf upgrade


SQLITE_DATABASE := ./main-applic/prisma/database-sql-lite.db
POSTGRES_CONTAINER := db_postgres_container

BACKUP_DIR := $(shell pwd)/backup
BACKUP_FILE_CONTAINER := /app/backup/postgres_data_only_backup_$(shell date +%F_%H-%M-%S).sql
BACKUP_FILE_CONTAINER2 := /app/backup/postgres_data_only_backup.sql


# из дева на прод
import_to_postgres:
	@if [ ! -f "$(SQLITE_DATABASE)" ]; then \
		echo "❌ Файл SQLite базы $(SQLITE_DATABASE) не найден!"; \
		exit 1; \
	fi
	@if [ ! -s "$(SQLITE_DATABASE)" ]; then \
		echo "❌ Файл SQLite базы $(SQLITE_DATABASE) пустой!"; \
		exit 1; \
	fi
	@if ! docker ps --filter "name=$(POSTGRES_CONTAINER)" --filter "status=running" | grep -q $(POSTGRES_CONTAINER); then \
		echo "❌ Контейнер $(POSTGRES_CONTAINER) не запущен!"; \
		exit 1; \
	fi
	@echo "📦 Копируем SQLite базу в контейнер $(POSTGRES_CONTAINER)..."
	@docker cp $(SQLITE_DATABASE) $(POSTGRES_CONTAINER):/app/database-sql-lite.db
	@echo "🚀 Формируем конфиг pgloader..."
	@docker exec -e PG_CONN="$(DATABASE_URL)" $(POSTGRES_CONTAINER) /opt/venv/bin/python /render_template.py
	@echo "🚀 Запускаем pgloader внутри контейнера $(POSTGRES_CONTAINER)..."
	@docker exec -u root $(POSTGRES_CONTAINER) pgloader /import.load || (echo "❌ Ошибка pgloader!"; exit 1)
	@echo "✅ Готово!"


# из прода на дев
export_to_sqlite:
	@docker exec -u root -e PG_CONN="$(DATABASE_URL)" $(POSTGRES_CONTAINER) /opt/venv/bin/python /migrate.py
	@mkdir -p $(BACKUP_DIR)
	@rm -f "$(BACKUP_DIR)/_backup_database-sql-lite.db"
	@echo "📦 Копируем файл на хост в $(BACKUP_DIR)/_backup_database-sql-lite.db ..."
	@docker cp $(POSTGRES_CONTAINER):/backup/_backup_database-sql-lite.db $(BACKUP_DIR)/_backup_database-sql-lite.db || \
		(echo "❌ Ошибка копирования, попробуйте запустить с sudo или проверьте права"; exit 1)
	@echo "✅ Готово!"


backup_postgres:
	@if ! docker ps --filter "name=$(POSTGRES_CONTAINER)" --filter "status=running" | grep -q $(POSTGRES_CONTAINER); then \
		echo "❌ Контейнер $(POSTGRES_CONTAINER) не запущен!"; \
		exit 1; \
	fi
	@echo "🚀 Формируем строку подключения из .env..."
	@PG_USER=$(MY_DB_USER_DEV); \
	PG_PASS=$(MY_DB_PASSWORD_DEV); \
	PG_DB=$(MY_DB_NAME_DEV); \
	echo "Создаём папку для бэкапов в контейнере..."; \
	docker exec $(POSTGRES_CONTAINER) mkdir -p /app/backup; \
	echo "🚀 Запускаем pg_dump с опцией --data-only внутри контейнера..."; \
	docker exec -e PGPASSWORD=$$PG_PASS $(POSTGRES_CONTAINER) sh -c "pg_dump -U $$PG_USER -d $$PG_DB --data-only --inserts -f $(BACKUP_FILE_CONTAINER)"; \
	echo "Копируем бэкап в файл с фиксированным именем..."; \
	docker exec $(POSTGRES_CONTAINER) cp $(BACKUP_FILE_CONTAINER) $(BACKUP_FILE_CONTAINER2); \
	echo "✅ Бэкапы сохранены в $(BACKUP_FILE_CONTAINER) и $(BACKUP_FILE_CONTAINER2) внутри контейнера $(POSTGRES_CONTAINER)"; \
	echo "Создаём папку для бэкапов на хосте: $(BACKUP_DIR)"; \
	mkdir -p $(BACKUP_DIR); \
	echo "📦 Копируем бэкапы на хост..."; \
	docker cp $(POSTGRES_CONTAINER):$(BACKUP_FILE_CONTAINER) $(BACKUP_DIR)/; \
	docker cp $(POSTGRES_CONTAINER):$(BACKUP_FILE_CONTAINER2) $(BACKUP_DIR)/; \
	echo "✅ Бэкапы скопированы в $(BACKUP_DIR)/";
