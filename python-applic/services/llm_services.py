import os
import json
import requests # type: ignore
from typing import Dict, List, Optional, Union

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"

        self.main_model = "z-ai/glm-4.5-air:free"
        # self.main_model = "x-ai/grok-4-fast:free"
        # self.main_model = "google/gemini-2.5-flash"

        self.str_model = "x-ai/grok-code-fast-1"
        self.payed_model = "z-ai/glm-4.5-air"
        # self.payed_model = "google/gemini-2.5-flash"

        self.model_search = "perplexity/sonar"
        self.long_content_model = "x-ai/grok-4"

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://n8n-seo.space",
            "X-Title": "Search Engine Optimization",
        }

    def _make_request(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> Dict:
        payload: Dict[str, Union[str, float, int, dict, list]] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            response = requests.post(self.base_url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"OpenRouter API error: {e}") from e

    def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> Union[str, Dict]:
        """Универсальный метод генерации ответа"""
        messages = [{"role": "user", "content": prompt}]
        response = self._make_request(messages, model or self.main_model, temperature, max_tokens, json_mode)
        content = response["choices"][0]["message"]["content"]
        return json.loads(content) if json_mode else content

    # Шорткаты для удобства
    def generate_response(self, prompt: str) -> str:
        return self.generate(prompt, temperature=0.3)

    def generate_paid_response(self, prompt: str, temperature: float, max_tokens: int = 25000) -> str:
        return self.generate(prompt, model=self.payed_model, max_tokens=max_tokens, temperature=temperature)

    def generate_long_content(self, prompt: str, max_tokens: int = 35000) -> str:
        return self.generate(prompt, max_tokens=max_tokens, model=self.long_content_model, temperature=0.7)

    def generate_structured_response(self, prompt: str) -> Dict:
        return self.generate(prompt, model=self.long_content_model, temperature=0.3, json_mode=True)

    def generate_response_with_search(self, prompt: str) -> str:
        return self.generate(prompt, model=self.model_search, temperature=0.7)

    def extract_text_from_html(self, html_content: str, max_tokens: int = 5000) -> str:
        prompt = f"""
        Извлеки основной читабельный текст из HTML.
        Игнорируй скрипты, стили, навигацию и рекламу.
        Верни только текст.

        HTML:
        {html_content}
        """
        return self.generate_long_content(prompt, max_tokens=max_tokens)
