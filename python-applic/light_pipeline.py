from dataclasses import asdict
import os
from prefect.task_runners import ConcurrentTaskRunner # type: ignore
from prefect import get_run_logger # type: ignore
from cache import Cache
from prefect import task # type: ignore
from models import LightTask
from services.google_sheets import GoogleSheetsService
from services.urls_to_database import urls_to_database
from services.vector_store import VectorStoreService
from services.vector_ingestion_service import VectorIngestionService


@task(retries=3, retry_delay_seconds=10)
def read_light_tasks(sheets_service: GoogleSheetsService, spreadsheet_id: str, sheet_name: str) -> list[LightTask]:
    """Чтение задач из Google Sheets"""
    data = sheets_service.read_sheets(spreadsheet_id, sheet_name)
    data = data if isinstance(data, list) else [data]

    return [
        LightTask(
            status=item.get("status", ""),
            url=item.get("url", "")
        )
        for item in data[:3450]  # Ограничение количества записей
    ]


class LightPipeline:
    def __init__(self, resume: bool = True):
        self.resume = resume
        self.cache = Cache()
        self.sheets_service = GoogleSheetsService()
        self.logger = None

    def _get_vector_ingestion(self, spreadsheet_id: str, sheet_name: str) -> VectorIngestionService:
        """Ленивая инициализация сервиса векторизации"""
        if not self.logger:
            raise ValueError("Logger должен быть инициализирован")

        vector_store = VectorStoreService(logger=self.logger)
        return VectorIngestionService(
            vector_store, self.sheets_service, spreadsheet_id, sheet_name, self.logger
        )

    def run(self, sheet_name: str = "Main"):
        """Основной метод запуска пайплайна"""
        self.logger = get_run_logger()
        spreadsheet_id = os.getenv("GOOGLE_LIGHT_ID")

        if not spreadsheet_id:
            raise ValueError("Не задан GOOGLE_LIGHT_ID")

        self.logger.info("🚀 Запуск LIGHT пайплайна...")

        # Этап 1: Чтение данных
        light_tasks = self._get_light_tasks(spreadsheet_id, sheet_name)
        self.logger.info(f"📖 Прочитано {len(light_tasks)} заданий")

        # Этап 2: Обработка URL
        valid_tasks, tasks_to_process, skipped_count = self._filter_tasks(light_tasks)

        self.logger.info(
            f"🔗 Валидных URL: {len(valid_tasks)}, "
            f"к обработке: {len(tasks_to_process)}, "
            f"пропущено: {skipped_count}"
        )

        # Этап 3: Векторизация
        processed_results = self._process_urls(tasks_to_process, spreadsheet_id, sheet_name)

        # Статистика и логирование
        stats = self._log_statistics(valid_tasks, tasks_to_process, processed_results, skipped_count)

        return {
            "light_tasks": light_tasks,
            "processed_results": processed_results,
            "stats": stats
        }

    def _get_light_tasks(self, spreadsheet_id: str, sheet_name: str) -> list[LightTask]:
        """Получение списка задач (с кэшированием при resume=True)"""
        cache_key = "0_a_light_tasks"

        if self.resume:
            cached_tasks = self.cache.get(cache_key)
            if cached_tasks:
                return [LightTask(**task) for task in cached_tasks]

        # Чтение новых данных
        tasks = read_light_tasks(self.sheets_service, spreadsheet_id, sheet_name)

        if self.resume:
            self.cache.set(cache_key, [asdict(task) for task in tasks])

        return tasks

    def _filter_tasks(self, light_tasks: list[LightTask]) -> tuple[list, list, int]:
        """Фильтрация задач по статусу и валидности URL"""
        valid_tasks = [t for t in light_tasks if t.url and t.url.strip()]

        completed_statuses = {"completed", "error"}
        tasks_to_process = [
            t for t in valid_tasks
            if str(t.status).strip().lower() not in completed_statuses
        ]

        skipped_count = len(valid_tasks) - len(tasks_to_process)

        return valid_tasks, tasks_to_process, skipped_count

    def _process_urls(self, tasks_to_process: list[LightTask], spreadsheet_id: str, sheet_name: str) -> dict:
        """Обработка URL через сервис векторизации"""
        cache_key = "0_b_light_processed_results"

        if self.resume:
            cached_results = self.cache.get(cache_key)
            if cached_results:
                return cached_results

        vector_ingestion = self._get_vector_ingestion(spreadsheet_id, sheet_name)
        results = urls_to_database(tasks_to_process, vector_ingestion, self.logger)

        if self.resume:
            self.cache.set(cache_key, results)

        return results

    def _log_statistics(self, valid_tasks: list, tasks_to_process: list,
                        processed_results: dict, skipped_count: int) -> dict:
        """Логирование статистики и ошибок"""
        stats = {
            "total_found": len(valid_tasks),
            "total_processed": len(tasks_to_process),
            "success": len(processed_results["success"]),
            "errors": len(processed_results["errors"]),
            "skipped": skipped_count,
        }

        self.logger.info(f"📊 Статистика: {stats}")

        # Логирование ошибок (первые 5)
        if processed_results["errors"]:
            self.logger.warning("❌ Проблемные URL:")
            error_samples = ", ".join(
                f"{err['url']}: {err['error']}"
                for err in processed_results["errors"][:5]
            )
            self.logger.warning(error_samples)

        return stats
