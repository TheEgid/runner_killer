#!/usr/bin/env python3
import os
import sys
import sqlite3
from typing import List, Dict, Optional, Set, Tuple, Any, NoReturn, Generator
from datetime import datetime, timezone
import psycopg2

BACKUP_DIR = "/backup"
SQLITE_FILE = f"{BACKUP_DIR}/_backup_database-sql-lite.db"

SCHEMA_SQL: Dict[str, str] = {
    "user": """
    CREATE TABLE "user" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "username" TEXT NOT NULL DEFAULT '',
        "email" TEXT UNIQUE,
        "isemailconfirmed" BOOLEAN NOT NULL DEFAULT 1,
        "password" TEXT,
        "role" TEXT NOT NULL DEFAULT 'USER',
        "createdat" DATETIME NOT NULL DEFAULT NULL,
        "updatedat" DATETIME NOT NULL DEFAULT NULL,
        "tokenversion" INTEGER NOT NULL DEFAULT 0
    )
    """,
    "petitiondata": """
    CREATE TABLE "petitiondata" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "createdat" DATETIME NOT NULL DEFAULT NULL,
        "updatedat" DATETIME NOT NULL DEFAULT NULL,
        "authorid" TEXT,
        "petition" TEXT NOT NULL,
        CONSTRAINT "petitiondata_authorid_fkey" FOREIGN KEY ("authorid") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
    """,
    "yieldrow": """
    CREATE TABLE "yieldrow" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "entity" TEXT NOT NULL DEFAULT '',
        "createdat" DATETIME NOT NULL DEFAULT NULL,
        "updatedat" DATETIME NOT NULL DEFAULT NULL,
        "authorid" TEXT,
        CONSTRAINT "yieldrow_authorid_fkey" FOREIGN KEY ("authorid") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
    """,
}

DATETIME_COLUMNS: Dict[str, List[str]] = {
    "user": ["createdat", "updatedat"],
    "petitiondata": ["createdat", "updatedat"],
    "yieldrow": ["createdat", "updatedat"],
}


def to_unix_millis(value: Any) -> Optional[int]:
    """Преобразует datetime/строку/число в UNIX timestamp (мс) в UTC."""
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return int(value)

    if isinstance(value, datetime):
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.timestamp() * 1000)

    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except (ValueError, TypeError):
            print(f"[WARNING] Не удалось преобразовать дату '{value}'", file=sys.stderr)
            return None

    print(f"[WARNING] Неизвестный тип данных для даты: {type(value)}", file=sys.stderr)
    return None


def recreate_table(sqlite_conn: sqlite3.Connection, table: str, create_sql: str) -> None:
    cursor = sqlite_conn.cursor()
    cursor.execute(f'DROP TABLE IF EXISTS "{table}"')
    print(f"[INFO] Удалена старая таблица: {table}")

    cursor.execute(create_sql)
    print(f"[INFO] Создана новая таблица: {table}")


def create_tables(sqlite_conn: sqlite3.Connection) -> None:
    """Создаёт таблицы SQLite согласно SCHEMA_SQL."""
    with sqlite_conn:
        for table, create_sql in SCHEMA_SQL.items():
            recreate_table(sqlite_conn, table, create_sql)


def get_common_columns(pg_cursor, sqlite_conn: sqlite3.Connection, table: str) -> List[str]:
    """Возвращает список общих колонок между PostgreSQL и SQLite для таблицы."""
    columns = [desc[0] for desc in pg_cursor.description]
    sqlite_columns_info = sqlite_conn.execute(f'PRAGMA table_info("{table}")').fetchall()
    sqlite_columns = {col[1] for col in sqlite_columns_info}

    # print(f"[DEBUG] Колонки PostgreSQL для '{table}': {columns}")
    # print(f"[DEBUG] Колонки SQLite для '{table}': {list(sqlite_columns)}")

    common_cols = [col for col in columns if col in sqlite_columns]
    if not common_cols:
        print(f"[WARNING] Нет общих колонок для таблицы '{table}', пропускаем миграцию.")
    return common_cols


def fetch_rows( pg_cursor: psycopg2.extensions.cursor, batch_size: int = 1000) -> Generator[List[Tuple[Any, ...]], None, None]:
    """Генератор, который возвращает данные из PostgreSQL батчами."""
    while True:
        rows: List[Tuple[Any, ...]] = pg_cursor.fetchmany(batch_size)
        if not rows:
            break
        yield rows


def convert_row(row: tuple, columns: List[str], table: str) -> tuple:
    row_dict = dict(zip(columns, row))
    for col in DATETIME_COLUMNS.get(table, []):
        if col in row_dict and row_dict[col] is not None:
            row_dict[col] = to_unix_millis(row_dict[col])
    return tuple(row_dict[c] for c in columns if c in row_dict)


def migrate_table( pg_conn: psycopg2.extensions.connection,  sqlite_conn: sqlite3.Connection,  table: str, user_ids: Optional[Set[str]] = None) -> None:
    print(f"\n[INFO] Миграция данных для таблицы '{table}'...")

    with pg_conn.cursor(f"{table}_cursor") as pg_cursor:
        pg_cursor.execute(f'SELECT * FROM "{table}"')

        first_rows: List[Tuple[Any, ...]] = pg_cursor.fetchmany(1)
        if not first_rows:
            print(f"[INFO] Нет данных для таблицы '{table}'.")
            return

        pg_columns: List[str] = [desc[0] for desc in pg_cursor.description]

        sqlite_columns_info: List[Tuple] = sqlite_conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        sqlite_columns: List[str] = [col[1] for col in sqlite_columns_info]

        # print(f"[DEBUG] Колонки PostgreSQL для '{table}': {pg_columns}")
        # print(f"[DEBUG] Колонки SQLite для '{table}': {sqlite_columns}")

        common_columns: List[str] = [col for col in pg_columns if col in sqlite_columns]
        placeholders: str = ", ".join(["?"] * len(common_columns))

        insert_sql: str = f'INSERT INTO "{table}" ({", ".join(common_columns)}) VALUES ({placeholders})'
        # print(f"[DEBUG] Строка INSERT для таблицы '{table}': {insert_sql}")

        def filter_row(row_dict: Dict[str, Any]) -> Dict[str, Any]:
            if user_ids is not None and table in ("yieldrow", "petitiondata"):
                if row_dict.get("authorid") not in user_ids:
                    row_dict["authorid"] = None
            return row_dict

        rows_migrated: int = 0
        batch_rows: List[Tuple[Any, ...]] = []
        columns: List[str] = pg_columns

        # Добавляем первую строку с фильтрацией
        for row in first_rows:
            row_dict: Dict[str, Any] = dict(zip(columns, row))
            row_dict = filter_row(row_dict)
            for col in DATETIME_COLUMNS.get(table, []):
                if col in row_dict and row_dict[col] is not None:
                    row_dict[col] = to_unix_millis(row_dict[col])
            batch_rows.append(tuple(row_dict[c] for c in common_columns))

        # Обрабатываем остальные данные батчами
        for rows_batch in fetch_rows(pg_cursor, batch_size=1000):
            for row in rows_batch:
                row_dict = dict(zip(columns, row))
                row_dict = filter_row(row_dict)
                for col in DATETIME_COLUMNS.get(table, []):
                    if col in row_dict and row_dict[col] is not None:
                        row_dict[col] = to_unix_millis(row_dict[col])
                batch_rows.append(tuple(row_dict[c] for c in common_columns))

            try:
                with sqlite_conn:
                    sqlite_conn.executemany(insert_sql, batch_rows)
                rows_migrated += len(batch_rows)
            except sqlite3.IntegrityError as e:
                print(f"[ERROR] Ошибка вставки в таблицу '{table}': {e}")
                print(f"[ERROR] Пример проблемных данных: {batch_rows[:5]}")
            batch_rows.clear()

        # Вставляем остаток, если остался
        if batch_rows:
            try:
                with sqlite_conn:
                    sqlite_conn.executemany(insert_sql, batch_rows)
                rows_migrated += len(batch_rows)
            except sqlite3.IntegrityError as e:
                print(f"[ERROR] Ошибка вставки в таблицу '{table}': {e}")
                print(f"[ERROR] Пример проблемных данных: {batch_rows[:5]}")

        print(f"[INFO] Вставлено строк: {rows_migrated} в таблицу '{table}'")


def migrate_data(pg_conn_str: str, sqlite_file: str) -> None:
    try:
        if os.path.exists(sqlite_file):
            os.remove(sqlite_file)
            print(f"[INFO] Удалён существующий файл SQLite: {os.path.abspath(sqlite_file)}")

        print(f"[INFO] Файл SQLite будет создан по пути: {os.path.abspath(sqlite_file)}")
        pg_conn: psycopg2.extensions.connection = psycopg2.connect(pg_conn_str)
        sqlite_conn: sqlite3.Connection = sqlite3.connect(sqlite_file)
        sqlite_conn.execute("PRAGMA foreign_keys = ON;")

        create_tables(sqlite_conn)

        # Начальный набор user_ids (после создания таблиц он пуст)
        user_ids: Set[str] = {row[0] for row in sqlite_conn.execute('SELECT id FROM "user"')} if 'user' in SCHEMA_SQL else set()

        table_list = ["user", "yieldrow", "petitiondata"]

        migrate_table(pg_conn, sqlite_conn, "user")

        # После миграции user читаем user_ids заново из SQLite
        user_ids: Set[str] = {row[0] for row in sqlite_conn.execute('SELECT id FROM "user"')}

        for table in (t for t in table_list if t != "user"):
            try:
                migrate_table(pg_conn, sqlite_conn, table, user_ids=user_ids)
            except psycopg2.Error as e:
                print(f"[ERROR] Ошибка при миграции таблицы '{table}': {e}", file=sys.stderr)
                continue

        sqlite_conn.commit()
        sqlite_conn.close()

    except psycopg2.Error as pg_err:
        print(f"[ERROR] Ошибка подключения к PostgreSQL: {pg_err}", file=sys.stderr)
        sys.exit(1)
    except sqlite3.Error as sqlite_err:
        print(f"[ERROR] Ошибка при работе с SQLite: {sqlite_err}", file=sys.stderr)
        sys.exit(1)
    finally:
        if 'pg_conn' in locals() and pg_conn:
            pg_conn.close()
        if 'sqlite_conn' in locals() and sqlite_conn:
            sqlite_conn.close()


def show_counts_dynamic(sqlite_file: str, tables_dict: Dict[str, List[str]]) -> None:
    conn = sqlite3.connect(sqlite_file)
    cursor = conn.cursor()

    queries = []
    for table in tables_dict.keys():
        queries.append(f"SELECT '{table}' AS table_name, COUNT(*) AS row_count FROM {table}")

    full_query = " UNION ALL ".join(queries)

    cursor.execute(full_query)
    rows = cursor.fetchall()
    for table_name, count in rows:
        print(f"Таблица {table_name}: {count} строк")
    conn.close()


def main() -> NoReturn:
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    pg_conn: Optional[str] = os.environ.get("PG_CONN")
    if not pg_conn:
        print("[ERROR] Не задана переменная окружения PG_CONN", file=sys.stderr)
        sys.exit(1)
    migrate_data(pg_conn, SQLITE_FILE)
    show_counts_dynamic(SQLITE_FILE, DATETIME_COLUMNS)

    sys.exit(0)


if __name__ == "__main__":
    main()
