from typing import List, Dict, Any
from prefect import get_run_logger, task, get_client  # type: ignore
from prefect.context import get_run_context  # type: ignore
from prefect.cache_policies import NO_CACHE  # type: ignore
from prefect.states import Cancelling  # type: ignore
from models import LightTask
from services.vector_ingestion_service import VectorIngestionService
import asyncio


@task(retries=3, retry_delay_seconds=10, cache_policy=NO_CACHE)
def process_single_url(task_obj: LightTask, vector_ingestion: VectorIngestionService) -> Dict[str, Any]:
    logger = get_run_logger()
    logger.info(f"🔄 Обработка {task_obj.url}")
    try:
        success = vector_ingestion.ingest_url(task_obj)
        return {"url": task_obj.url, "status": "completed" if success else "error"}
    except Exception as e:
        logger.error(f"❌ Ошибка {task_obj.url}: {e}")
        return {"url": task_obj.url, "status": "error", "error": str(e)}


async def check_if_cancelled(flow_run_id: str) -> bool:
    """Проверяет, находится ли flow run в состоянии отмены"""
    try:
        async with get_client() as client:
            flow_run = await client.read_flow_run(flow_run_id)
            # Проверяем, если состояние "CANCELLING" или "CANCELLED"
            if flow_run.state:
                state_name = flow_run.state.name.upper()
                return state_name in ["CANCELLING", "CANCELLED"]
    except Exception:
        pass
    return False


def urls_to_database(
    tasks_to_process: List[LightTask],
    vector_ingestion: VectorIngestionService,
    logger=None,
    batch_size: int = 1,
) -> Dict[str, List[Dict[str, Any]]]:
    if logger is None:
        logger = get_run_logger()

    # Получаем ID текущего flow run
    flow_run_id = None
    try:
        context = get_run_context()
        if context and hasattr(context, 'flow_run'):
            flow_run_id = str(context.flow_run.id)
    except Exception:
        # Если мы не в контексте flow, продолжаем без проверки отмены
        pass

    logger.info(f"🚀 Запуск обработки {len(tasks_to_process)} URL, batch_size={batch_size}")

    processed_results = {"success": [], "errors": [], "skipped": []}
    batches = [tasks_to_process[i:i + batch_size] for i in range(0, len(tasks_to_process), batch_size)]

    for batch_num, batch in enumerate(batches, 1):
        # Проверка отмены через API, если у нас есть flow_run_id
        if flow_run_id:
            # Используем asyncio для вызова async функции
            is_cancelled = asyncio.run(check_if_cancelled(flow_run_id))
            if is_cancelled:
                logger.warning(f"⏹ Flow отменён, прерываем обработку на батче {batch_num}")
                # Добавляем необработанные URL в skipped
                for task_obj in batch:
                    processed_results["skipped"].append({
                        "url": task_obj.url,
                        "status": "skipped",
                        "error": "Flow cancelled"
                    })
                # Добавляем оставшиеся батчи в skipped
                for remaining_batch in batches[batch_num:]:
                    for task_obj in remaining_batch:
                        processed_results["skipped"].append({
                            "url": task_obj.url,
                            "status": "skipped",
                            "error": "Flow cancelled"
                        })
                break

        logger.info(f"🔧 Батч {batch_num}/{len(batches)} ({len(batch)} URL)")

        futures = [process_single_url.submit(task_obj, vector_ingestion) for task_obj in batch]

        for i, fut in enumerate(futures):
            # Проверка отмены перед получением результата
            if flow_run_id:
                is_cancelled = asyncio.run(check_if_cancelled(flow_run_id))
                if is_cancelled:
                    logger.warning("⏹ Flow отменён, прерываем текущий батч")
                    # Отменяем оставшиеся futures
                    for j in range(i, len(futures)):
                        try:
                            # Пытаемся отменить незавершенные задачи
                            if not futures[j].done():
                                futures[j].cancel()
                            # Добавляем в skipped
                            processed_results["skipped"].append({
                                "url": batch[j].url,
                                "status": "skipped",
                                "error": "Flow cancelled"
                            })
                        except Exception:
                            pass
                    # Добавляем оставшиеся батчи в skipped
                    for remaining_batch_idx in range(batch_num, len(batches)):
                        for task_obj in batches[remaining_batch_idx]:
                            processed_results["skipped"].append({
                                "url": task_obj.url,
                                "status": "skipped",
                                "error": "Flow cancelled"
                            })
                    break

            try:
                res = fut.result()
                if res["status"] == "completed":
                    processed_results["success"].append(res)
                elif res.get("error") == "Rate limit исчерпан":
                    processed_results["skipped"].append(res)
                else:
                    processed_results["errors"].append(res)
            except Exception as e:
                # Если задача была отменена или произошла ошибка
                logger.warning(f"⚠️ Задача прервана или ошибка: {e}")
                processed_results["skipped"].append({
                    "url": batch[i].url,
                    "status": "skipped",
                    "error": str(e)
                })

    logger.info(
        f"✅ Завершено. Success={len(processed_results['success'])}, "
        f"Errors={len(processed_results['errors'])}, Skipped={len(processed_results['skipped'])}"
    )
    return processed_results
