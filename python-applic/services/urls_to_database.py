import time
from typing import List, Dict, Any
from prefect import task # type: ignore
from prefect.cache_policies import NO_CACHE # type: ignore

from models import LightTask


@task(cache_policy=NO_CACHE, retries=2, retry_delay_seconds=5)
def process_single_url(task_obj: LightTask, vector_ingestion, logger) -> Dict[str, Any]:
    """
    Обрабатывает один URL с автоматическим повтором при RateLimitError.
    """
    max_retries = 5
    delay = 10  # секунд между попытками при rate limit

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"🔄 Обработка {task_obj.url} (попытка {attempt})")
            success = vector_ingestion.ingest_url(task_obj)
            if success:
                return {"url": task_obj.url, "status": "completed"}
            else:
                return {"url": task_obj.url, "status": "error", "error": "Не удалось обработать"}
        # except Error:
        #     logger.warning(f"⚠️ Rate limit для {task_obj.url}, повтор через {delay}s (попытка {attempt})")
        #     time.sleep(delay)
        except Exception as e:
            logger.error(f"❌ Критическая ошибка для {task_obj.url}: {e}")
            return {"url": task_obj.url, "status": "error", "error": str(e)}

    # Если все retries исчерпаны
    return {"url": task_obj.url, "status": "error", "error": "Rate limit исчерпан после нескольких попыток"}


@task(cache_policy=NO_CACHE, retries=3, retry_delay_seconds=10)
def urls_to_database(tasks_to_process: List, vector_ingestion, logger) -> Dict[str, List[Dict[str, Any]]]:
    logger.info(f"🚀 Запуск обработки {len(tasks_to_process)} URL")

    processed_results = {
        "success": [],
        "errors": [],
        "skipped": []
    }

    chunk_size = 2
    chunks = [tasks_to_process[i:i + chunk_size] for i in range(0, len(tasks_to_process), chunk_size)]

    for chunk_num, chunk in enumerate(chunks, 1):
        logger.info(f"🔧 Обработка {chunk_num}/{len(chunks)} ({len(chunk)} URL)")

        results_futures = [
            process_single_url.submit(task_obj, vector_ingestion, logger)
            for task_obj in chunk
        ]

        chunk_results = [f.result() for f in results_futures]

        # Классифицируем результаты
        for res in chunk_results:
            if res["status"] == "completed":
                processed_results["success"].append(res)
            elif res.get("error") == "Rate limit исчерпан после нескольких попыток":
                processed_results["skipped"].append(res)
            else:
                processed_results["errors"].append(res)

    logger.info(f"✅ Все URL обработаны. Итого успешных: {len(processed_results['success'])}, "
                f"ошибок: {len(processed_results['errors'])}, пропущено: {len(processed_results['skipped'])}")
    return processed_results
