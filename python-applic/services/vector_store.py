import os
import time
from supabase import create_client, Client # type: ignore
from typing import List, Dict, Any
from services.local_embedder import LocalCohereClient
# import import cohere # type: ignore

from models import SearchResult


class VectorStoreService:
    def __init__(self, logger):
        self.logger = logger
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")
        # self.cohere_api_key = os.getenv("COHERE_API_KEY")

        if not all([self.supabase_url, self.supabase_key]):
            missing = [var for var, val in [
                ("SUPABASE_URL", self.supabase_url),
                ("SUPABASE_KEY", self.supabase_key),
                # ("COHERE_API_KEY", self.cohere_api_key)
            ] if not val]
            raise ValueError(f"Отсутствуют переменные окружения: {', '.join(missing)}")

        try:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            # self.cohere_client = cohere.Client(self.cohere_api_key)
            self.cohere_client = LocalCohereClient()
            self.logger.info("✅ VectorStoreService инициализирован успешно")
        except Exception as e:
            self.logger.error(f"❌ Ошибка инициализации VectorStoreService: {e}")
            raise

    def add_chunks(self, chunks: List[Dict[str, Any]]) -> bool:

        if not chunks:
            self.logger.warning("⚠️ Попытка добавить пустой список чанков")
            return False

        try:
            self.logger.info(f"📝 Добавляем {len(chunks)} чанков в векторную БД...")

            texts = [chunk["text"] for chunk in chunks if chunk.get("text")]
            if not texts:
                self.logger.error("❌ Не найдено текстов для создания эмбеддингов")
                return False

            # response = self.cohere_client.embed(
            #     texts=texts,
            #     model="embed-multilingual-light-v3.0",
            #     input_type="search_document"
            # )
            # embeddings = response.embeddings embed_documents
            response = self.cohere_client.embed_documents(texts=texts)
            embeddings_list = response.embeddings.tolist()

            # ✅ Проверка размерности
            if len(embeddings_list) == 0:
                self.logger.error("❌ Эмбеддинги пустые")
                return False

            # Проверка размерности первого эмбеддинга
            if len(embeddings_list[0]) != 384:
                self.logger.error(f"❌ Неожиданная размерность эмбеддинга запроса: {len(embeddings_list)}, ожидается 384")
                return False

            # if embeddings and len(embeddings[0]) != 384:
            #     self.logger.error(f"❌ Неожиданная размерность эмбеддинга: {len(embeddings[0])}, ожидается 384")
            #     return False

            rows = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings_list)):
                # Берем метадату из чанка, если она есть
                metadata = dict(chunk.get("metadata", {}))

                if "loc" not in metadata:
                    chunk_size = len(chunk["text"].splitlines()) or 1
                    start_line = i * chunk_size + 1
                    end_line = (i + 1) * chunk_size
                    metadata["loc"] = {"lines": {"from": start_line, "to": end_line}}

                # Дополняем обязательные поля, если их нет в метадате
                metadata.setdefault("source", chunk.get("source", "blob"))
                metadata.setdefault("blobType", chunk.get("blob_type", "text/plain"))
                metadata.setdefault("chunk_index", chunk.get("chunk_index", i))
                metadata.setdefault("total_chunks", chunk.get("total_chunks", len(chunks)))

                # URL уже должен быть в метадате из _smart_chunk_content
                # но на всякий случай добавляем проверку
                if "url" not in metadata and "url" in chunk:
                    metadata["url"] = chunk["url"]

                rows.append({
                    "content": chunk["text"],
                    "metadata": metadata,
                    "embedding": embedding
                })

            result = self.supabase.table("novaya").upsert(rows).execute()

            if result.data:
                self.logger.info(f"✅ Успешно добавлено {len(result.data)} чанков")
                return True
            else:
                self.logger.error("❌ Данные не были добавлены в БД")
                return False

        except Exception as e:
            self.logger.error(f"❌ Ошибка при добавлении чанков: {e}")
            return False


    def search(self, query: str, top_k: int = 5, similarity_threshold: float = 0.5) -> List[SearchResult]:
        """
        ✅ Поиск с использованием SQL функции
        """
        if not query or not query.strip():
            self.logger.warning("⚠️ Пустой запрос для поиска")
            return []

        try:
            self.logger.info(f"🔍 Поиск по запросу: '{query[:50]}...'")

            # # ✅ Создаем эмбеддинг для запроса (размерность 384)
            query_response = self.cohere_client.embed_query(query)
            query_embedding_list = query_response.tolist()

            # Проверка размерности
            if len(query_embedding_list) != 384:
                self.logger.error(f"❌ Неожиданная размерность эмбеддинга запроса: {len(query_embedding_list)}, ожидается 384")

            # query_response = self.cohere_client.embed(
            #     texts=[query],
            #     model="embed-multilingual-light-v3.0",
            #     input_type='search_query'
            # )
            # query_embedding = query_response.embeddings[0]
            # if len(query_embedding) != 384:
            #     self.logger.error(f"❌ Неожиданная размерность query эмбеддинга: {len(query_embedding)}")
            #     return []

            # ✅ Используем RPC функцию
            result = self.supabase.rpc(
                'match_documents_novaya_v2',
                {
                    'query_embedding': query_embedding_list,
                    'match_threshold': similarity_threshold,
                    'match_count': top_k
                }
            ).execute()

            if not result.data:
                self.logger.info("ℹ️ Не найдено похожих документов")
                return []

            # ✅ Преобразуем результаты
            search_results = []
            for row in result.data:
                search_results.append(SearchResult(
                    content=row['content'],
                    score=row.get('similarity', 0.0),
                    metadata=row.get('metadata', {}),
                    id=str(row.get('id', ''))
                ))

            self.logger.info(f"✅ Найдено {len(search_results)} релевантных документов")
            return search_results

        except Exception as e:
            self.logger.error(f"❌ Ошибка при поиске: {e}")
            # ✅ Простой fallback
            return self._text_search_fallback(query, top_k)

    def _text_search_fallback(self, query: str, top_k: int) -> List[SearchResult]:
        """
        ✅ Простой текстовый поиск как fallback
        """
        try:
            self.logger.info("🔄 Используем текстовый поиск как fallback...")

            # Поиск по содержимому
            result = (
                self.supabase.table("novaya")
                .select("id, content, metadata")
                .ilike("content", f"%{query}%")
                .limit(top_k)
                .execute()
            )

            search_results = []
            if result.data:
                for row in result.data:
                    search_results.append(SearchResult(
                        content=row['content'],
                        score=0.5,  # Фиксированный score для текстового поиска
                        metadata=row.get('metadata', {}),
                        id=str(row.get('id', ''))
                    ))

            self.logger.info(f"✅ Текстовый поиск: найдено {len(search_results)} документов")
            return search_results

        except Exception as e:
            self.logger.error(f"❌ Ошибка текстового поиска: {e}")
            return []

    def url_exists(self, url: str, retries: int = 3, delay: float = 1.0) -> bool:
        """Проверка существования URL с повторными попытками"""
        if not url:
            return False

        for attempt in range(1, retries + 1):
            try:
                result = (
                    self.supabase.table("novaya")
                    .select("id")
                    .or_(f"metadata->>URL.eq.{url},metadata->>url.eq.{url}")
                    .limit(1)
                    .execute()
                )
                return bool(result.data)
            except Exception as e:
                self.logger.error(f"❌ Ошибка при проверке URL {url} (попытка {attempt}): {e}")
                if attempt < retries:
                    time.sleep(delay)
                else:
                    return False

    def question_exists(self, data: str) -> bool:
        """Проверка, содержится ли data в поле content"""
        if not data:
            return False

        try:
            result = (
                self.supabase.table("novaya")
                .select("id")
                .like("content", f"%{data}%")  # ищем подстроку
                .limit(1)
                .execute()
            )
            exists = bool(result.data and len(result.data) > 0)
            return exists

        except Exception as e:
            self.logger.error(f"❌ Ошибка при проверке вопроса '{data}': {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Получение статистики базы данных"""
        try:
            total_result = self.supabase.table("novaya").select("id", count="exact").execute()
            total_count = total_result.count if total_result.count is not None else 0

            return {
                "total_documents": total_count,
                "database_table": "novaya",
                "embedding_model": "embed-multilingual-light-v3.0",
                "embedding_dimension": 384
            }

        except Exception as e:
            self.logger.error(f"❌ Ошибка при получении статистики: {e}")
            return {"error": str(e)}

    def add_documents(self, documents: List[str], metadata_list: List[Dict[str, Any]] = None, chunk_size: int = 10000) -> bool:
        """Метод для добавления документов в векторное хранилище с разбиением на чанки"""
        if metadata_list is None:
            metadata_list = [{"source": "direct_add"} for _ in documents]

        chunks = []
        for doc_id, (doc, metadata) in enumerate(zip(documents, metadata_list)):
            # Разбиваем текст на чанки по chunk_size символов
            for i in range(0, len(doc), chunk_size):
                chunk_text = doc[i:i+chunk_size]

                # вычисляем строки для loc
                line_count = len(chunk_text.splitlines()) or 1
                start_line = i // chunk_size * line_count + 1
                end_line = start_line + line_count - 1

                chunks.append({
                    "text": chunk_text,
                    "metadata": metadata,
                    "chunk_index": i // chunk_size,
                    "total_chunks": (len(doc) + chunk_size - 1) // chunk_size,
                    "start_line": start_line,
                    "end_line": end_line
                })

        return self.add_chunks(chunks)
