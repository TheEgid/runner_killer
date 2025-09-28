from sentence_transformers import SentenceTransformer # type: ignore
from typing import List
import numpy as np # type: ignore

class LocalCohereEmbedResponse:
    """Имитация объекта response Cohere с атрибутом .embeddings"""
    def __init__(self, embeddings: np.ndarray):
        # Принудительно преобразуем к numpy.ndarray
        if isinstance(embeddings, list):
            embeddings = np.array(embeddings)
        if embeddings.ndim != 2 or embeddings.shape[1] != 384:
            raise ValueError(f"Неверная размерность эмбеддингов: {embeddings.shape} (ожидалось (_, 384))")
        self.embeddings = embeddings

class LocalCohereClient:
    def __init__(self, model_name: str = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'):
        """
        Инициализация локального клиента для эмбеддингов.
        """
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)

    def embed(self, texts: List[str], input_type: str = 'default', batch_size: int = 32) -> LocalCohereEmbedResponse:
        """
        Основной метод генерации эмбеддингов для списка текстов.
        :param texts: список строк
        :param input_type: 'search_query', 'search_document' или 'default'
        :param batch_size: размер батча для CPU
        :return: LocalCohereEmbedResponse с .embeddings размерности (_, 384)
        """
        processed_texts = self._preprocess_texts(texts, input_type)
        embeddings = self.model.encode(
            processed_texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        # Проверка размерности
        if embeddings.shape[1] != 384:
            raise ValueError(f"Неверная размерность эмбеддингов: {embeddings.shape[1]} (ожидалось 384)")
        return LocalCohereEmbedResponse(embeddings)

    def embed_documents(self, texts: List[str], batch_size: int = 32) -> LocalCohereEmbedResponse:
        """
        Генерация эмбеддингов для документов (search_document)
        """
        return self.embed(texts, input_type='search_document', batch_size=batch_size)

    def embed_query(self, text: str, batch_size: int = 32) -> np.ndarray:
        """
        Генерация эмбеддинга для запроса (search_query)
        Возвращает numpy-массив размерности (384,)
        """
        response = self.embed([text], input_type='search_query', batch_size=batch_size)
        query_emb = response.embeddings[0]
        if query_emb.shape[0] != 384:
            raise ValueError(f"Неверная размерность эмбеддинга запроса: {query_emb.shape[0]} (ожидалось 384)")
        return query_emb

    def _preprocess_texts(self, texts: List[str], input_type: str) -> List[str]:
        """
        Внутренняя функция для предобработки текста в зависимости от типа.
        """
        if input_type == 'search_query':
            return [t.lower().strip() for t in texts]
        elif input_type == 'search_document':
            return [t.strip() for t in texts]
        else:
            return texts

# -------------------- Пример использования --------------------

# if __name__ == "__main__":
#     client = LocalCohereClient()

#     texts = [
#         "Привет, как дела?",
#         "Это пример документа для embedding"
#     ]
#     query = "Как сделать embedding на локальной модели?"

#     # Эмбеддинги документов
#     response = client.embed_documents(texts)
#     embeddings = response.embeddings
#     print("Документы:", embeddings.shape)  # (_, 384)

#     # Эмбеддинг запроса
#     query_embedding = client.embed_query(query)
#     print("Запрос:", query_embedding.shape)  # (384,)
