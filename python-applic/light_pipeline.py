from dataclasses import asdict
import os
from prefect import flow, get_run_logger # type: ignore
from cache import Cache
from light_content.b_1_data_input import LightDataInputStep
from models import LightTask

from services.google_sheets import GoogleSheetsService
from services.urls_to_database import urls_to_database
from services.vector_store import VectorStoreService
from services.vector_ingestion_service import VectorIngestionService

class LightPipeline:
    def __init__(self, resume: bool = True):
        self.resume = resume
        self.cache = Cache()
        self.sheets_service = GoogleSheetsService()

        self.data_input: LightDataInputStep | None = None
        self.vector_ingestion = None
        self.logger = None

    def _init_stage_1(self):
        """Этап 1: Чтение данных"""
        if self.data_input is None:
            self.data_input = LightDataInputStep(self.sheets_service)

    def _init_stage_2(self, spreadsheet_id: str, sheet_name: str):
        """Этап 2: Векторизация"""
        if self.vector_ingestion is None:

            if self.logger is None:
                raise ValueError("Logger должен быть инициализирован перед stage 2")

            self.vector_store = VectorStoreService(logger=self.logger)
            self.vector_ingestion = VectorIngestionService(
                self.vector_store,
                self.sheets_service,
                spreadsheet_id,
                sheet_name,
                self.logger
            )

    @flow
    def run(self, sheet_name: str = "Main"):
        """Основной поток выполнения пайплайна"""
        self.logger = get_run_logger()
        spreadsheet_id = os.getenv("GOOGLE_LIGHT_ID")

        if not spreadsheet_id:
            raise ValueError("Не задан GOOGLE_LIGHT_ID")

        self.logger.info("🚀 Запуск LIGHT пайплайна...")

        # ====== ЭТАП 1: ЧТЕНИЕ ДАННЫХ ======
        self._init_stage_1()
        light_tasks = None

        if self.resume:
            light_tasks_data = self.cache.get("0_a_light_tasks")
            if light_tasks_data:
                light_tasks = [LightTask(**task_data) for task_data in light_tasks_data]

        if not light_tasks:
            light_tasks = self.data_input.read_light_tasks(spreadsheet_id, sheet_name)
            light_tasks_data = [asdict(task) for task in light_tasks]
            self.cache.set("0_a_light_tasks", light_tasks_data)

        self.logger.info(f"📖 Прочитано {len(light_tasks)} заданий")

        # ====== ЭТАП 2: НАПОЛНЕНИЕ ВЕКТОРНОЙ БД ======
        self._init_stage_2(spreadsheet_id, sheet_name)

        # Фильтруем только задачи с непустыми URL
        valid_tasks = [task for task in light_tasks if task.url and task.url.strip()]
        self.logger.info(f"🔗 Валидных URL для обработки: {len(valid_tasks)}")

        # Проверяем, есть ли уже обработанные URL
        processed_statuses = {"completed", "done"}
        tasks_to_process = [
            task for task in valid_tasks
            if str(task.status).strip().lower() not in processed_statuses
        ]

        skipped_count = len(valid_tasks) - len(tasks_to_process)
        if skipped_count > 0:
            self.logger.info(f"⏭️ Пропущено уже обработанных URL: {skipped_count}")

        self.logger.info(f"🎯 К обработке: {len(tasks_to_process)} URL")

        processed_results = None
        if self.resume:
            processed_results = self.cache.get("0_b_light_processed_results")

        if not processed_results:
            processed_results = urls_to_database(
                tasks_to_process=tasks_to_process,
                vector_ingestion=self.vector_ingestion,
                logger=self.logger,
            )
            self.cache.set("0_b_light_processed_results", processed_results)

        # Выводим статистику
        success_count = len(processed_results["success"])
        error_count = len(processed_results["errors"])
        total_processed = len(tasks_to_process)

        self.logger.info(f"📊 Статистика обработки:")
        self.logger.info(f"🎯 К обработке было: {total_processed}")
        self.logger.info(f"✅ Успешно: {success_count}")
        self.logger.info(f"❌ Ошибки: {error_count}")
        self.logger.info(f"⏭️ Пропущено (уже обработано): {skipped_count}")

        if processed_results["errors"]:
            self.logger.warning("❌ Проблемные URL:")
            for error in processed_results["errors"][:5]:
                self.logger.warning(f"  - {error['url']}: {error['error']}")

        return {
            "light_tasks": light_tasks,
            "processed_results": processed_results,
            "stats": {
                "total_found": len(valid_tasks),
                "total_processed": total_processed,
                "success": success_count,
                "errors": error_count,
                "skipped": skipped_count
            }
        }
