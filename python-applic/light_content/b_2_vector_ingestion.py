import time
from prefect import task # type: ignore
from typing import List, Dict
from models import LightTask
from services.vector_ingestion_service import VectorIngestionService

class LightVectorIngestionStep:
    def __init__(self, vector_ingestion_service: VectorIngestionService, logger):
        self.vector_ingestion_service = vector_ingestion_service
        self.logger = logger

    @task(retries=2, retry_delay_seconds=5)
    def process_tasks_batch(self, tasks: List[LightTask], batch_size: int = 10) -> Dict:
        """Обработка задач батчами"""

        results = {
            "success": [],
            "errors": [],
            "total_processed": 0
        }

        # Фильтруем валидные задачи
        valid_tasks = [task for task in tasks if task.url and task.url.strip()]

        # Обрабатываем батчами
        for i in range(0, len(valid_tasks), batch_size):
            batch = valid_tasks[i:i + batch_size]
            self.logger.info(f"🔄 Обрабатываем батч {i//batch_size + 1}: {len(batch)} URL")

            for task in batch:
                try:
                    success = self.vector_ingestion_service.ingest_url(task)

                    if success:
                        results["success"].append(task.url)
                    else:
                        results["errors"].append({"url": task.url, "error": "Processing failed"})

                    results["total_processed"] += 1
                    time.sleep(1.5)  # Rate limiting

                except Exception as e:
                    self.logger.error(f"❌ Ошибка обработки {task.url}: {e}")
                    results["errors"].append({"url": task.url, "error": str(e)})
                    results["total_processed"] += 1

        return results
