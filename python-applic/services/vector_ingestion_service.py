from typing import List, Dict
from models import LightTask
from services.simple_scraper import SimpleScraperService
from services.vector_store import VectorStoreService


class VectorIngestionService:
    """Сервис для сохранения URL в векторную БД"""

    def __init__(self, vector_store: VectorStoreService, sheets_service, spreadsheet_id: str, sheet_name: str, logger):
        self.vector_store = vector_store
        self.sheets_service = sheets_service
        self.spreadsheet_id = spreadsheet_id
        self.sheet_name = sheet_name
        self.logger = logger

        # ✅ Используем SimpleScraperService управляющий LLM
        self.scraper = SimpleScraperService(logger=self.logger, use_llm=True)
        # self.scraper = SimpleScraperService(logger=self.logger, use_llm=False)

    def ingest_url(self, task: LightTask) -> bool:
        """Обработка и сохранение одного URL в векторную БД"""
        try:
            if hasattr(self.vector_store, 'url_exists') and self.vector_store.url_exists(task.url):
                self.logger.info(f"URL уже в БД: {task.url}")
                self.sheets_service.update_task_status(
                    self.spreadsheet_id, self.sheet_name, task.url, "completed"
                )
                return True

            self.sheets_service.update_task_status(
                self.spreadsheet_id, self.sheet_name, task.url, "processing"
            )

            # ✅ Используем метод scrape_page для гарантии чистого текста
            content = self.scraper.scrape_page(task.url, clean_html=True)

            # ✅ Дополнительная проверка
            if not content or len(content.strip()) < 100:
                self.logger.error(f"Контент слишком короткий или отсутствует для URL: {task.url}")
                self.sheets_service.update_task_status(
                    self.spreadsheet_id, self.sheet_name, task.url, "error"
                )
                return False

            # ✅ Финальная валидация перед векторизацией
            if not isinstance(content, str):
                self.logger.error(f"Контент не является строкой для URL: {task.url}")
                return False

            # Разбиваем на чанки (content уже точно чистый текст)
            chunks = self._smart_chunk_content(content, task.url)

            if not chunks:
                self.logger.error(f"Не удалось создать чанки для URL: {task.url}")
                self.sheets_service.update_task_status(
                    self.spreadsheet_id, self.sheet_name, task.url, "error"
                )
                return False

            # Добавляем в векторную БД
            try:
                self.vector_store.add_chunks(chunks)
                if hasattr(self.vector_store, 'mark_url_processed'):
                    self.vector_store.mark_url_processed(task.url)
            except Exception as e:
                self.logger.error(f"Ошибка добавления в векторную БД для {task.url}: {e}")
                self.sheets_service.update_task_status(
                    self.spreadsheet_id, self.sheet_name, task.url, "error"
                )
                return False

            # Обновляем статус на "completed"
            self.sheets_service.update_task_status(
                self.spreadsheet_id, self.sheet_name, task.url, "completed"
            )

            self.logger.info(f"✅ Успешно обработан URL: {task.url}, добавлено чанков: {len(chunks)}")
            return True

        except Exception as e:
            self.logger.error(f"❌ Ошибка обработки {task.url}: {e}")
            self.sheets_service.update_task_status(
                self.spreadsheet_id, self.sheet_name, task.url, "error"
            )
            if hasattr(self.vector_store, 'mark_url_error'):
                self.vector_store.mark_url_error(task.url)
            return False

    def _smart_chunk_content(self, content: str, url: str,
                            min_size: int = 800, max_size: int = 1200) -> List[Dict]:
        """Умное разбиение контента на чанки с сохранением URL в метадате"""
        if not content or len(content.strip()) < 50:
            return []

        paragraphs = content.split('\n\n')
        chunks = []
        buffer = ''

        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue

            if buffer and (len(buffer) + len(paragraph) + 2) > max_size:
                if len(buffer) >= min_size:
                    chunks.append({
                        "text": buffer.strip(),
                        "metadata": {
                            "chunk_id": f"{url}#{len(chunks)}",
                            "url": url,
                            "source": "simple_scraper"
                        }
                    })
                    buffer = paragraph
                else:
                    buffer = buffer + '\n\n' + paragraph
            else:
                buffer = buffer + '\n\n' + paragraph if buffer else paragraph

            while len(buffer) > max_size:
                split_pos = buffer.rfind('\n', 0, max_size)
                if split_pos == -1:
                    split_pos = buffer.rfind(' ', 0, max_size)
                if split_pos == -1:
                    split_pos = max_size

                chunks.append({
                    "text": buffer[:split_pos].strip(),
                    "metadata": {
                        # "chunk_id": f"{url}#{len(chunks)}",
                        "url": url,
                        "source": "simple_scraper"
                    }
                })
                buffer = buffer[split_pos:].strip()

        if buffer.strip() and len(buffer.strip()) >= min_size:
            chunks.append({
                "text": buffer.strip(),
                "metadata": {
                    # "chunk_id": f"{url}#{len(chunks)}",
                    "url": url,
                    "source": "simple_scraper"
                }
            })

        return chunks

    def __del__(self):
        """Закрываем scraper при удалении объекта"""
        if hasattr(self, 'scraper'):
            self.scraper.close()
