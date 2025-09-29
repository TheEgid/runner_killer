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
        if not success:
            # Проверяем, не связано ли это с rate limit
            # Добавьте соответствующую логику здесь
            pass
        return {"url": task_obj.url, "status": "completed" if success else "error"}
    except Exception as e:
        logger.error(f"❌ Ошибка {task_obj.url}: {e}")
        error_msg = str(e)
        # Если это rate limit, возвращаем специальный статус
        if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
            return {"url": task_obj.url, "status": "skipped", "error": "Rate limit исчерпан"}
        return {"url": task_obj.url, "status": "error", "error": error_msg}


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

def sync_check_if_cancelled(flow_run_id: str) -> bool:
    return asyncio.run(check_if_cancelled(flow_run_id))


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
        pass

    logger.info(f"🚀 Запуск обработки {len(tasks_to_process)} URL, batch_size={batch_size}")

    processed_results = {"success": [], "errors": [], "skipped": []}
    batches = [tasks_to_process[i:i + batch_size] for i in range(0, len(tasks_to_process), batch_size)]

    for batch_num, batch in enumerate(batches, 1):
        # Проверка отмены через API
        if flow_run_id and sync_check_if_cancelled(flow_run_id):
            logger.warning(f"⏹ Flow отменён, прерываем обработку на батче {batch_num}")
            # Добавляем все оставшиеся задачи в skipped
            for remaining_batch in batches[batch_num-1:]:
                for task_obj in remaining_batch:
                    processed_results["skipped"].append({
                        "url": getattr(task_obj, 'url', 'Unknown URL'),
                        "status": "skipped",
                        "error": "Flow cancelled"
                    })
            break

        logger.info(f"🔧 Батч {batch_num}/{len(batches)} ({len(batch)} URL)")

        futures = [process_single_url.submit(task_obj, vector_ingestion) for task_obj in batch]

        for i, fut in enumerate(futures):
            # Проверка отмены перед получением результата
            if flow_run_id and asyncio.run(check_if_cancelled(flow_run_id)):
                logger.warning("⏹ Flow отменён, прерываем текущий батч")
                # Отменяем оставшиеся futures и добавляем в skipped
                for j in range(i, len(futures)):
                    try:
                        if not futures[j].done():
                            futures[j].cancel()
                    except Exception:
                        pass
                    processed_results["skipped"].append({
                        "url": getattr(batch[j], 'url', 'Unknown URL'),
                        "status": "skipped",
                        "error": "Flow cancelled"
                    })
                # Добавляем оставшиеся батчи в skipped
                for remaining_batch_idx in range(batch_num, len(batches)):
                    for task_obj in batches[remaining_batch_idx]:
                        processed_results["skipped"].append({
                            "url": getattr(task_obj, 'url', 'Unknown URL'),
                            "status": "skipped",
                            "error": "Flow cancelled"
                        })
                break

            try:
                res = fut.result()
                # Безопасная проверка ключей
                status = res.get("status", "unknown")
                error_msg = res.get("error", "")

                if status == "completed":
                    processed_results["success"].append(res)
                elif error_msg == "Rate limit исчерпан":
                    processed_results["skipped"].append(res)
                else:
                    # Гарантируем, что в errors есть все необходимые ключи
                    error_entry = {
                        "url": res.get("url", "Unknown URL"),
                        "status": status,
                        "error": error_msg or "Unknown error"
                    }
                    # Добавляем остальные поля из res
                    error_entry.update({k: v for k, v in res.items() if k not in error_entry})
                    processed_results["errors"].append(error_entry)

            except Exception as e:
                logger.warning(f"⚠️ Задача прервана или ошибка: {e}")
                processed_results["skipped"].append({
                    "url": getattr(batch[i], 'url', 'Unknown URL') if i < len(batch) else "Unknown URL",
                    "status": "skipped",
                    "error": str(e)
                })

    logger.info(
        f"✅ Завершено. Success={len(processed_results['success'])}, "
        f"Errors={len(processed_results['errors'])}, Skipped={len(processed_results['skipped'])}"
    )
    return processed_results
