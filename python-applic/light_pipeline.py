from dataclasses import asdict
import os
from prefect import flow, get_run_logger  # type: ignore
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
        self.vector_ingestion: VectorIngestionService | None = None
        self.logger = None

    def _init_stage_1(self):
        if not self.data_input:
            self.data_input = LightDataInputStep(self.sheets_service)

    def _init_stage_2(self, spreadsheet_id: str, sheet_name: str):
        if not self.vector_ingestion:
            if not self.logger:
                raise ValueError("Logger должен быть инициализирован перед stage 2")
            vector_store = VectorStoreService(logger=self.logger)
            self.vector_ingestion = VectorIngestionService(
                vector_store, self.sheets_service, spreadsheet_id, sheet_name, self.logger
            )

    @flow
    def run(self, sheet_name: str = "Main"):
        self.logger = get_run_logger()
        spreadsheet_id = os.getenv("GOOGLE_LIGHT_ID")
        if not spreadsheet_id:
            raise ValueError("Не задан GOOGLE_LIGHT_ID")

        self.logger.info("🚀 Запуск LIGHT пайплайна...")

        # ===== ЭТАП 1: ЧТЕНИЕ ДАННЫХ =====
        self._init_stage_1()
        light_tasks_data = self.cache.get("0_a_light_tasks") if self.resume else None
        if light_tasks_data:
            light_tasks = [LightTask(**t) for t in light_tasks_data]
        else:
            light_tasks = self.data_input.read_light_tasks(spreadsheet_id, sheet_name)
            self.cache.set("0_a_light_tasks", [asdict(t) for t in light_tasks])

        self.logger.info(f"📖 Прочитано {len(light_tasks)} заданий")

        # ===== ЭТАП 2: ВЕКТОРИЗАЦИЯ =====
        self._init_stage_2(spreadsheet_id, sheet_name)

        # Фильтруем только валидные URL и задачи для обработки
        valid_tasks = [t for t in light_tasks if t.url and t.url.strip()]
        tasks_to_process = [
            t for t in valid_tasks
            if str(t.status).strip().lower() not in {"completed", "done"}
        ]
        skipped_count = len(valid_tasks) - len(tasks_to_process)

        self.logger.info(f"🔗 Валидных URL: {len(valid_tasks)}, к обработке: {len(tasks_to_process)}, пропущено: {skipped_count}")

        processed_results = self.cache.get("0_b_light_processed_results") if self.resume else None
        if not processed_results:
            processed_results = urls_to_database(
                tasks_to_process=tasks_to_process,
                vector_ingestion=self.vector_ingestion,
                logger=self.logger,
            )
            self.cache.set("0_b_light_processed_results", processed_results)

        # Статистика
        stats = {
            "total_found": len(valid_tasks),
            "total_processed": len(tasks_to_process),
            "success": len(processed_results["success"]),
            "errors": len(processed_results["errors"]),
            "skipped": skipped_count
        }
        self.logger.info(f"📊 Статистика: {stats}")

        if processed_results["errors"]:
            self.logger.warning("❌ Проблемные URL:")
            for err in processed_results["errors"][:5]:
                self.logger.warning(f"  - {err['url']}: {err['error']}")

        return {
            "light_tasks": light_tasks,
            "processed_results": processed_results,
            "stats": stats
        }
