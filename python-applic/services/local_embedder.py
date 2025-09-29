import os
from typing import List
import numpy as np  # type: ignore
import cohere  # type: ignore

class DummyModel:
    """Заглушка для SentenceTransformer"""

    def encode(self, texts: List[str], batch_size: int = 32, show_progress_bar: bool = False, convert_to_numpy: bool = True):
        n = len(texts)
        rng = np.random.default_rng(seed=42)
        return rng.random((n, 384), dtype=np.float32)

class LocalCohereEmbedResponse:
    """Единый объект ответа с .embeddings (numpy.ndarray)"""

    def __init__(self, embeddings: np.ndarray):
        if isinstance(embeddings, list):
            embeddings = np.array(embeddings)
        if embeddings.ndim != 2 or embeddings.shape[1] != 384:
            raise ValueError(f"Неверная размерность эмбеддингов: {embeddings.shape} (ожидалось (_, 384))")
        self.embeddings = embeddings

class LocalCohereClient:
    def __init__(self, use_cohere: bool = False):
        """
        Клиент для эмбеддингов:
        - use_cohere=False → локальная модель (SentenceTransformer)
        - use_cohere=True  → настоящий Cohere Client
        """
        self.use_cohere = use_cohere

        if self.use_cohere:
            cohere_api_key = os.getenv("COHERE_API_KEY")
            if not cohere_api_key:
                raise ValueError("Для use_cohere=True нужен cohere_api_key")
            self.client = cohere.Client(cohere_api_key)
            self.model = None
        else:
            os.environ["CUDA_VISIBLE_DEVICES"] = ""  # отключаем GPU
            from sentence_transformers import SentenceTransformer  # type: ignore
            self.model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", device="cpu") # type: ignore
            # self.model = DummyModel()

    def embed(self, texts: List[str], input_type: str = "default", batch_size: int = 32) -> LocalCohereEmbedResponse:
        if self.use_cohere:
            response = self.client.embed(texts=texts, input_type=input_type)
            embeddings = np.array(response.embeddings)
        else:
            processed_texts = self._preprocess_texts(texts, input_type)
            embeddings = self.model.encode(
                processed_texts, batch_size=batch_size, show_progress_bar=False, convert_to_numpy=True
            )
        return LocalCohereEmbedResponse(embeddings)

    def embed_documents(self, texts: List[str], batch_size: int = 32) -> LocalCohereEmbedResponse:
        return self.embed(texts, input_type="search_document", batch_size=batch_size)

    def embed_query(self, text: str, batch_size: int = 32) -> np.ndarray:
        response = self.embed([text], input_type="search_query", batch_size=batch_size)
        return response.embeddings[0]

    def embed_queries(self, texts: List[str], batch_size: int = 32) -> LocalCohereEmbedResponse:
        return self.embed(texts, input_type="search_query", batch_size=batch_size)

    def _preprocess_texts(self, texts: List[str], input_type: str) -> List[str]:
        if input_type == "search_query":
            return [t.lower().strip() for t in texts]
        elif input_type == "search_document":
            return [t.strip() for t in texts]
        return texts
