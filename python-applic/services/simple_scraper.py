import os
import re
import json
from typing import Dict, Any, Optional
from urllib.parse import urljoin, urlparse
from prefect.utilities.asyncutils import run_coro_as_sync
from bs4 import BeautifulSoup

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode,
    LLMConfig,
    LLMExtractionStrategy,
)

class ContentTooShortError(Exception):
    """Exception raised when extracted content is too short."""
    pass

def clean_llm_response(llm_response: str) -> str:
    """
    ✅ Очистка ответа LLM от JSON структур и форматирования
    """
    if not llm_response:
        return ""

    # Если ответ содержит JSON-подобные структуры, извлекаем только content
    try:
        # Попытка парсинга как JSON
        if llm_response.strip().startswith('{') or llm_response.strip().startswith('['):
            parsed = json.loads(llm_response)
            if isinstance(parsed, dict) and 'content' in parsed:
                return parsed['content']
            elif isinstance(parsed, list):
                contents = []
                for item in parsed:
                    if isinstance(item, dict) and 'content' in item:
                        contents.append(item['content'])
                return '\n\n'.join(contents)
    except:
        pass

    # Удаляем JSON-подобные фрагменты
    text = llm_response

    # Удаляем строки с JSON полями
    lines = text.split('\n')
    cleaned_lines = []

    for line in lines:
        line = line.strip()

        # Пропускаем JSON поля
        if re.match(r'^"[^"]+"\s*:\s*[^,}]+[,}]?$', line):
            continue
        if re.match(r'^"error"\s*:\s*(true|false)$', line):
            continue
        if re.match(r'^"index"\s*:\s*\d+$', line):
            continue
        if re.match(r'^"tags"\s*:\s*"[^"]*"$', line):
            continue

        # Удаляем JSON структуры из строки
        line = re.sub(r'"error"\s*:\s*(true|false)', '', line)
        line = re.sub(r'"index"\s*:\s*\d+', '', line)
        line = re.sub(r'"tags"\s*:\s*"[^"]*"', '', line)
        line = re.sub(r'"content"\s*:\s*"', '', line)

        # Очищаем от лишних кавычек и запятых
        line = re.sub(r'^[",\s]+|[",\s]+$', '', line)

        if line and len(line) > 3:  # ✅ Уменьшил с 5 до 3
            cleaned_lines.append(line)

    # Объединяем очищенные строки
    cleaned_text = '\n'.join(cleaned_lines)

    # Дополнительная очистка JSON остатков
    cleaned_text = re.sub(r'\{\s*"[^"]+"\s*:\s*"[^"]*"\s*\}', '', cleaned_text)
    cleaned_text = re.sub(r'"[^"]*"\s*:\s*"[^"]*"', '', cleaned_text)
    cleaned_text = re.sub(r'\[\s*\{[^}]*\}\s*\]', '', cleaned_text)

    return cleaned_text.strip()

def advanced_text_cleaning(text: str) -> str:
    """
    ✅ Более мягкая очистка текста для лучшего извлечения контента
    """
    if not text:
        return ""

    # ✅ Сначала очищаем от LLM JSON ответов
    text = clean_llm_response(text)

    # ✅ Удаляем все HTML теги, если они остались
    text = re.sub(r'<[^>]+>', '', text)

    # ✅ Удаляем HTML entities
    text = re.sub(r'&[a-zA-Z0-9]+;', ' ', text)

    lines = text.split('\n')
    cleaned_lines = []

    for line in lines:
        line = line.strip()

        # ✅ Более мягкие условия фильтрации
        # Skip empty lines
        if not line:
            continue

        # Skip very short lines without letters (уменьшил с 10 до 5)
        if len(line) < 5 and not any(char.isalpha() for char in line):
            continue

        # Skip lines with only special characters or digits (оставил как есть)
        if re.match(r'^[\W\d_]+$', line):
            continue

        # ✅ Более мягкая проверка URL (добавил минимальную длину)
        if len(line) > 20 and re.match(r'^(https?://|www\.|/+[\w/]+)', line):
            continue

        # ✅ Skip очевидные навигационные элементы
        navigation_words = ['главная', 'home', 'меню', 'menu', 'навигация', 'navigation', 'войти', 'login', 'регистрация', 'register']
        if len(line) < 20 and any(nav_word in line.lower() for nav_word in navigation_words):
            continue

        # ✅ Skip JSON-like remnants
        if re.match(r'^[{}\[\]",]+$', line):
            continue

        cleaned_lines.append(line)

    # Join lines, preserving double newlines for paragraphs
    cleaned_text = '\n'.join(cleaned_lines)

    # Compress multiple spaces into a single one
    cleaned_text = re.sub(r' {2,}', ' ', cleaned_text)
    # Compress multiple newlines into at most two, to preserve paragraphs
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)

    # ✅ Более мягкая финальная очистка (убрал агрессивное удаление символов)
    # Оставляем больше символов для википедии (ссылки, скобки и т.д.)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text)

    return cleaned_text.strip()

def validate_text_content(content: str, min_length: int = 50) -> bool:  # ✅ Уменьшил с 100 до 50
    """
    ✅ Более мягкая валидация контента
    """
    if not content or not isinstance(content, str):
        return False

    # Проверяем минимальную длину
    if len(content.strip()) < min_length:
        return False

    # Проверяем, что есть буквы (не только символы/цифры)
    if not re.search(r'[а-яёА-ЯЁa-zA-Z]', content):
        return False

    # ✅ Более мягкое соотношение букв (уменьшил с 30% до 15%)
    letters = len(re.findall(r'[а-яёА-ЯЁa-zA-Z]', content))
    total_chars = len(re.sub(r'\s', '', content))

    if total_chars > 0 and (letters / total_chars) < 0.15:  # Минимум 15% букв
        return False

    return True

class SimpleScraperService:
    """
    An asynchronous web scraper that reliably extracts text.
    It uses an LLM strategy as the primary method and falls back to BeautifulSoup.
    ✅ Гарантирует извлечение только чистого текста
    """

    def __init__(self, logger, use_llm: bool = True):
        self.use_llm = use_llm  # ✅ Флаг для включения/отключения LLM
        self.browser_config = BrowserConfig(headless=True)
        self.logger = logger

        if self.use_llm:
            self.api_key = os.getenv("OPENROUTER_API_KEY")
            if not self.api_key:
                raise ValueError("Environment variable 'OPENROUTER_API_KEY' is not found.")

            # ✅ Обновленная инструкция для LLM
            self.llm_extraction_strategy = LLMExtractionStrategy(
                llm_config=LLMConfig(
                    # provider="openrouter/moonshotai/kimi-k2-0905",
                    provider="openrouter/mistralai/mistral-small-3.2-24b-instruct:free",
                    api_token=self.api_key,
                    temperature=0.0,
                    max_tokens=2000,
                ),
                extraction_type="text",
                instruction=(
                    "Extract ONLY the main content text from the page. "
                    "Return PLAIN TEXT without any JSON, HTML tags, formatting, or structure. "
                    "Do NOT use quotes, brackets, or field names like 'content:', 'error:', 'index:'. "
                    "Just return the clean readable text content in natural language. "
                    "Ignore navigation menus, footers, advertisements, and unrelated parts. "
                    "Focus on the primary article or content body as continuous text."
                ),
                verbose=True
            )

    async def get_page_info(self, url: str) -> Dict[str, Any]:
        """
        Extracts content and metadata from a web page.
        ✅ Возвращает только валидированный чистый текст
        """
        self.logger.info(f"Starting scraping of URL: {url}")

        try:
            async with AsyncWebCrawler(config=self.browser_config) as crawler:
                if self.use_llm:
                    # Используем LLM стратегию
                    crawler_config = CrawlerRunConfig(
                        delay_before_return_html=2.0,
                        magic=True,
                        cache_mode=CacheMode.BYPASS,
                        extraction_strategy=self.llm_extraction_strategy,
                    )
                else:
                    # ✅ Режим без LLM - просто получаем HTML
                    crawler_config = CrawlerRunConfig(
                        delay_before_return_html=2.0,
                        magic=False,
                        cache_mode=CacheMode.BYPASS,
                    )

                result = await crawler.arun(url, config=crawler_config)

        except Exception as e:
            self.logger.error(f"❌ Crawler error for {url}: {e}")
            return self._create_error_response(url, f"Crawler error: {str(e)}")

        # Initialize content with a fallback approach
        cleaned_content: Optional[str] = None

        # Check LLM extraction result (только если используем LLM)
        if self.use_llm and result.success and result.extracted_content:
            # ✅ Добавляем логирование сырого ответа LLM для отладки
            self.logger.debug(f"Raw LLM response: {result.extracted_content[:200]}...")

            llm_cleaned_text = advanced_text_cleaning(result.extracted_content)

            # ✅ Валидируем LLM результат с более мягкими критериями
            if validate_text_content(llm_cleaned_text, min_length=50):
                cleaned_content = llm_cleaned_text
                self.logger.info("✅ LLM-based content extraction was successful.")
            else:
                self.logger.warning(f"⚠️ LLM-extracted content failed validation. Length: {len(llm_cleaned_text)}")

        # Если LLM отключен или не дал результат, используем BeautifulSoup
        if not cleaned_content:
            if not result.html:
                self.logger.error("❌ No HTML received for fallback. Failed to scrape.")
                return self._create_error_response(url, "Failed to get HTML from the page.")

            # ✅ Улучшенный fallback с BeautifulSoup
            cleaned_content = self._extract_with_beautifulsoup(result.html)

            if not validate_text_content(cleaned_content, min_length=50):
                self.logger.error("❌ Fallback extraction also failed validation.")
                return self._create_error_response(url, "All extraction methods failed validation.")

            self.logger.info("✅ BeautifulSoup extraction successfully extracted content.")

        # ✅ Финальная проверка на JSON остатки (более мягкая)
        cleaned_content = self._final_content_cleaning(cleaned_content)

        # Extract metadata from the raw HTML using BeautifulSoup
        metadata = self._extract_metadata(result.html or "", url)

        return {
            "url": url,
            "status_code": result.status_code or 200,
            "title": metadata["title"],
            "description": metadata["description"],
            "keywords": metadata["keywords"],
            "content": cleaned_content,  # ✅ Гарантированно чистый текст
            "content_length": len(cleaned_content),
            "links": metadata["links"],
            "success": True,
        }

    def _final_content_cleaning(self, content: str) -> str:
        """
        ✅ Более мягкая финальная очистка контента
        """
        if not content:
            return ""

        # Удаляем строки, которые явно выглядят как JSON поля
        lines = content.split('\n')
        final_lines = []

        for line in lines:
            line = line.strip()

            # ✅ Более мягкие условия - только явные JSON структуры
            # Пропускаем только очевидные JSON поля
            if re.match(r'^"[^"]+"\s*:\s*(true|false|null|\d+)$', line):
                continue
            if line.startswith('"error":') or line.startswith('"index":'):
                continue
            if re.match(r'^[{}\[\]",\s]*$', line):  # Только символы JSON
                continue

            # ✅ Уменьшил минимальную длину строки с 10 до 5
            if line and len(line) > 5:
                final_lines.append(line)

        return '\n'.join(final_lines)

    def _extract_with_beautifulsoup(self, html: str) -> str:
        """
        ✅ Улучшенное извлечение текста с BeautifulSoup для википедии
        """
        soup = BeautifulSoup(html, "html.parser")

        # Удаляем ненужные элементы
        for element in soup(['script', 'style', 'noscript', 'meta', 'link']):
            element.decompose()

        # ✅ Более мягкое удаление навигационных элементов
        # Удаляем только очевидные навигационные блоки
        for element in soup.find_all(class_=re.compile(r'(navbar|main-menu|sidebar|advertisement)', re.I)):
            element.decompose()

        # ✅ Приоритет для основного контента (особенно важно для википедии)
        main_content = None

        # Для википедии ищем специфичные селекторы
        wiki_selectors = ['#mw-content-text', '.mw-parser-output', '#content']
        for selector in wiki_selectors:
            main_element = soup.select_one(selector)
            if main_element:
                main_content = main_element.get_text(separator="\n", strip=True)
                break

        # Если не нашли википедийные блоки, ищем стандартные
        if not main_content:
            for selector in ['main', 'article', '.content', '.post', '.entry']:
                main_element = soup.select_one(selector)
                if main_element:
                    main_content = main_element.get_text(separator="\n", strip=True)
                    break

        if not main_content:
            main_content = soup.get_text(separator="\n", strip=True)

        return advanced_text_cleaning(main_content)

    def _extract_metadata(self, html: str, url: str) -> Dict[str, Any]:
        """Извлечение метаданных"""
        soup = BeautifulSoup(html, "html.parser")

        title_text = soup.title.get_text(strip=True) if soup.title else ""

        description_meta = soup.find("meta", attrs={"name": "description"})
        description_text = description_meta.get("content", "").strip() if description_meta else ""

        keywords_meta = soup.find("meta", attrs={"name": "keywords"})
        keywords_text = keywords_meta.get("content", "").strip() if keywords_meta else ""

        # Extract internal links
        parsed_url = urlparse(url)
        links = [
            urljoin(url, a["href"])
            for a in soup.find_all("a", href=True)
            if urlparse(urljoin(url, a["href"])).netloc == parsed_url.netloc
        ]
        unique_links = list(set(links))

        return {
            "title": title_text,
            "description": description_text,
            "keywords": keywords_text,
            "links": unique_links
        }

    def _create_error_response(self, url: str, error_message: str) -> Dict[str, Any]:
        """Создание ответа об ошибке"""
        return {
            "url": url,
            "success": False,
            "error_message": error_message,
            "status_code": 0,
            "content_length": 0,
            "content": "",  # ✅ Пустая строка, а не None
            "title": "",
            "description": "",
            "keywords": "",
            "links": []
        }

    def get_page_info_sync(self, url: str) -> Dict[str, Any]:
        """A synchronous wrapper for the asynchronous method."""
        return run_coro_as_sync(self.get_page_info(url))

    # ✅ Метод для получения только чистого текста (для векторной БД)
    def scrape_page(self, url: str, clean_html: bool = True) -> Optional[str]:
        """
        Простой метод для получения только текста
        Возвращает None при ошибке или валидированный чистый текст
        """
        try:
            page_info = self.get_page_info_sync(url)

            if not page_info["success"]:
                self.logger.error(f"❌ Scraping failed for {url}: {page_info.get('error_message', 'Unknown error')}")
                return None

            content = page_info["content"]

            # ✅ Финальная валидация с более мягкими критериями
            if validate_text_content(content, min_length=50):
                return content
            else:
                self.logger.error(f"❌ Content validation failed for {url} (length: {len(content) if content else 0})")
                return None

        except Exception as e:
            self.logger.error(f"❌ Exception in scrape_page for {url}: {e}")
            return None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()  # ✅ Гарантированное закрытие ресурсов
        self.logger.info("SimpleScraperService context manager exited.")

    def close(self):
        if hasattr(self, 'crawler') and self.crawler is not None:
            try:
                run_coro_as_sync(self.crawler.close())
            except Exception as e:
                self.logger.error(f"Error closing crawler: {e}")
            finally:
                self.crawler = None


if __name__ == "__main__":
    # ✅ Пример использования без LLM
    with SimpleScraperService(use_llm=False) as scraper:
        url_to_scrape = "https://ru.wikipedia.org/wiki/Кошка"

        try:
            # ✅ Тест метода для векторной БД
            clean_text = scraper.scrape_page(url_to_scrape)
            if clean_text:
                print("✅ Clean text extracted successfully!")
                print(f"Length: {len(clean_text)} characters")
                print("\n--- Clean Text Sample ---")
                print(clean_text[:500] + "...")
            else:
                print("❌ Failed to extract clean text")

        except ValueError as e:
            print(f"❌ Error: {e}")
        except Exception as e:
            print(f"❌ An unexpected error occurred: {e}")
