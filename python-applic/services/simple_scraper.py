import logging
import os
import json
import re
from typing import Dict, Any, Optional, List
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup  # type: ignore

from crawl4ai import (  # type: ignore
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode,
    LLMConfig,
    LLMExtractionStrategy,
)
from prefect.utilities.asyncutils import run_coro_as_sync  # type: ignore

logger = logging.getLogger(__name__)


class ContentTooShortError(Exception):
    """Exception raised when extracted content is too short."""
    pass


def clean_llm_response(llm_response: str) -> str:
    """
    Очистка ответа LLM от JSON-структур, сохраняя основной текст.
    """
    if not llm_response:
        return ""

    try:
        parsed = json.loads(llm_response)

        def flatten_content(obj):
            if isinstance(obj, str):
                return obj
            elif isinstance(obj, dict):
                if 'content' in obj:
                    content = obj['content']
                    if isinstance(content, list):
                        flattened = [flatten_content(item) for item in content if item]
                        return '\n\n'.join(flattened)
                    return str(content)
                return str(obj)
            elif isinstance(obj, list):
                return '\n\n'.join(flatten_content(item) for item in obj if item)
            else:
                return str(obj)

        if isinstance(parsed, dict) and 'content' in parsed:
            return flatten_content(parsed['content'])
        elif isinstance(parsed, list):
            return '\n\n'.join(flatten_content(item) for item in parsed if item)
        else:
            return str(parsed)

    except (json.JSONDecodeError, AttributeError, TypeError) as e:
        logger.debug(f"JSON parsing error: {e}")

    # Fallback: Strip HTML, filter lines
    text = re.sub(r'<.*?>', '', llm_response)
    lines = text.split('\n')
    cleaned_lines = [line.strip().replace('\\n', '\n').replace('\\t', '  ') for line in lines if line.strip() and len(line.strip()) > 3]
    return '\n'.join(cleaned_lines).strip()


def advanced_text_cleaning(text: str, preserve_formatting: bool = False) -> str:
    """Мягкая очистка с сохранением структуры."""
    if not text:
        return ""

    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&[a-zA-Z0-9#]+;', ' ', text)

    lines = text.split('\n')
    cleaned_lines = []

    for line in lines:
        line = line.strip()
        if not line or len(line) < 3:
            continue

        # Skip nav/UI (расширенно для Вики/Habr)
        nav_keywords = ['войти', 'login', 'регистрация', 'register', 'меню', 'menu', 'подписаться', 'subscribe', 'перейти к навигации', 'перейти к поиску', 'вики любит', 'заглавная', 'порталы', 'справка', 'карма', 'профиль', '@']
        if any(kw in line.lower() for kw in nav_keywords) and len(line) < 20:
            continue

        # Skip URLs
        if re.match(r'^https?://\S+$', line):
            continue

        if preserve_formatting and re.match(r'^(#{1,6}\s+|\d+\.\s+|- \s+)', line):
            cleaned_lines.append(line)
            continue

        cleaned_lines.append(line)

    cleaned_text = '\n'.join(cleaned_lines)
    cleaned_text = re.sub(r'\s{2,}', ' ', cleaned_text)
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
    return cleaned_text.strip()


def validate_text_content(content: str, min_length: int = 100, min_letters_ratio: float = 0.2) -> bool:
    """Валидация контента."""
    if not content or len(content.strip()) < min_length:
        return False

    letters = len(re.findall(r'[а-яёА-ЯЁa-zA-Z]', content))
    total_chars = len(re.sub(r'\s', '', content))

    if total_chars > 0 and (letters / total_chars) < min_letters_ratio:
        return False

    return True


def extract_with_beautifulsoup(html: str, site_specific: bool = True, url: str = "") -> str:
    """Fallback BS: Адаптирован минимально для Habr и Википедии (селекторы + простой фильтр)."""
    soup = BeautifulSoup(html, 'html.parser')

    # Удаляем шум
    for elem in soup(['script', 'style', 'noscript', 'meta', 'nav', 'header', 'footer', 'aside']):
        elem.decompose()

    extracted_text = ""
    elem_found = False
    parsed_url = urlparse(url)
    is_habr = 'habr.com' in parsed_url.netloc
    is_wiki = 'wikipedia.org' in parsed_url.netloc

    # Минимальные селекторы
    if is_habr:
        article_selectors = ['div.article-formatted-body', '#post-content-body']
    elif is_wiki:
        article_selectors = ['#mw-content-text', '.mw-parser-output']
    else:
        article_selectors = ['main', 'article', '.content', '.mw-parser-output', '#post-content-body']

    for selector in article_selectors:
        main_elem = soup.select_one(selector)
        if main_elem:
            elem_found = True
            extracted_text = main_elem.get_text(separator='\n', strip=True)
            logger.info(f"✅ BS: Elem '{selector}' found for {parsed_url.netloc}. Raw length: {len(extracted_text)} chars.")
            break

    if not elem_found:
        logger.warning(f"⚠️ BS: No main elem for {parsed_url.netloc}. Full text filter.")
        full_text = soup.get_text(separator='\n', strip=True)
        lines = full_text.split('\n')
        filtered_lines = []

        skip_section = False
        for line in lines:
            line = line.strip()
            if len(line) < 10:  # Смягчили
                continue

            # Skip nav/профиль
            skip_words = ['войти', 'регистрация', 'меню', 'подписаться', 'карма', 'профиль', '@', 'перейти к навигации', 'перейти к поиску', 'вики любит', 'заглавная', 'порталы', 'справка', 'узнать больше']
            if any(kw in line.lower() for kw in skip_words):
                skip_section = True
                continue
            if skip_section and len(line) < 30:
                continue

            # Начать сбор после nav (простой флаг: если длинная строка — статья)
            if len(line) > 50 or (len(line) > 20 and any(char.isalpha() for char in line)):
                skip_section = False
                filtered_lines.append(line)

        extracted_text = '\n'.join(filtered_lines)
        logger.info(f"BS fallback raw: {len(extracted_text)} chars (filtered).")

    cleaned = advanced_text_cleaning(extracted_text, preserve_formatting=True)
    logger.info(f"BS final: {len(cleaned)} chars. Sample: {cleaned[:150]}...")
    if len(cleaned) < 1000:  # Смягчили порог warning
        logger.warning(f"⚠️ BS too short ({len(cleaned)} chars) — JS issue?")

    return cleaned


def extract_metadata(html: str, url: str) -> Dict[str, Any]:
    """Извлечение метаданных."""
    soup = BeautifulSoup(html, 'html.parser')
    parsed_url = urlparse(url)

    title = soup.title.string.strip() if soup.title else ''
    desc = soup.find('meta', attrs={'name': 'description'})
    desc_text = desc.get('content', '').strip() if desc else ''
    keywords = soup.find('meta', attrs={'name': 'keywords'})
    kw_text = keywords.get('content', '').strip() if keywords else ''

    links = [urljoin(url, a.get('href', '')) for a in soup.find_all('a', href=True)
             if a.get('href') and urlparse(urljoin(url, a['href'])).netloc == parsed_url.netloc]
    unique_links = list(set(links))[:10]

    return {'title': title, 'description': desc_text, 'keywords': kw_text, 'links': unique_links}


def process_blocks(blocks: List[Any], max_blocks: int = 30, min_total_length: int = 2000) -> str:
    """Обработка блоков LLM."""
    if not blocks:
        return ""

    processed_blocks = []
    for i, block in enumerate(blocks[:max_blocks]):
        if isinstance(block, str) and len(block.strip()) > 10:
            cleaned = clean_llm_response(block)
        elif isinstance(block, (dict, list)):
            cleaned = clean_llm_response(json.dumps(block) if isinstance(block, dict) else str(block))
        else:
            continue

        if cleaned and len(cleaned.strip()) > 10:
            processed_blocks.append(cleaned)

    if processed_blocks:
        full_text = '\n\n'.join(processed_blocks)
        total_len = len(full_text)
        logger.info(f"Processed {len(processed_blocks)} LLM blocks: {total_len} chars.")
        if total_len < min_total_length:
            return ""
        return full_text
    return ""


class SimpleScraperService:
    """Минимальный скрапер (рабочий для Habr; + Вики селекторы)."""

    def __init__(
        self,
        logger: logging.Logger,
        use_llm: bool = False,  # По умолчанию off для стабильности
        preserve_formatting: bool = True,
        js_delay: float = 10.0  # Вернул 10s (рабочий)
    ):
        self.logger = logger
        self.preserve_formatting = preserve_formatting
        self.js_delay = js_delay
        self.browser_config = BrowserConfig(headless=True)  # Убрал UA (упростил)
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.llm_strategy = None

        if use_llm and self.api_key:
            self.llm_strategy = LLMExtractionStrategy(
                llm_config=LLMConfig(
                    provider="openrouter/mistralai/mistral-small-3.2-24b-instruct:free",
                    api_token=self.api_key,
                    temperature=0.0,
                    max_tokens=15000,
                ),
                extraction_type="text",
                instruction=(
                    "Extract ONLY the main article content from the page. "
                    "Return PLAIN TEXT without JSON or tags. Focus on body text, ignore nav/sidebars."
                ),
                verbose=True
            )
            self.logger.info(f"LLM init (delay={js_delay}s).")

    async def get_page_info(self, url: str, use_llm: Optional[bool] = None, max_retries: int = 2) -> Dict[str, Any]:
        if use_llm is None:
            use_llm = False  # Минимально: BS-only

        self.logger.info(f"Scraping {url} (LLM: {use_llm}, retries: {max_retries}, delay: {self.js_delay}s)")

        result = None
        for attempt in range(1, max_retries + 1):
            try:
                async with AsyncWebCrawler(config=self.browser_config) as crawler:
                    # Простой JS-код (минимальный, без setTimeout — чтобы избежать crash)
                    js_code = """
                    window.scrollTo(0, document.body.scrollHeight);
                    console.log('Scrolled for lazy load');
                    """

                    config = CrawlerRunConfig(
                        delay_before_return_html=self.js_delay,
                        magic=True,
                        cache_mode=CacheMode.BYPASS,
                        js_code=js_code,  # Только прокрутка
                    )
                    if use_llm:
                        config.extraction_strategy = self.llm_strategy

                    result = await crawler.arun(url, config=config)
                    logger.debug(f"Raw HTML length (attempt {attempt}): {len(result.html) if result.html else 0}")

                    if result.html:
                        test_bs = extract_with_beautifulsoup(result.html, site_specific=True, url=url)
                        min_success = 1000  # Смягчили для retry
                        if len(test_bs) > min_success:
                            break
                        else:
                            logger.warning(f"Attempt {attempt}: Short ({len(test_bs)} chars) — retrying...")

            except Exception as e:
                logger.error(f"❌ Error (attempt {attempt}): {e}")
                if attempt == max_retries:
                    return self._error_response(url, str(e))

        if not result or not result.success:
            return self._error_response(url, "Crawl failed.")

        # LLM (опционально)
        llm_content = None
        blocks_processed = 0
        if use_llm and result.extracted_content:
            extracted_raw = result.extracted_content
            if isinstance(extracted_raw, list):
                full_text = process_blocks(extracted_raw)
                if full_text:
                    llm_content = advanced_text_cleaning(full_text, self.preserve_formatting)
                    blocks_processed = len(extracted_raw)
            else:
                llm_content = advanced_text_cleaning(clean_llm_response(str(extracted_raw)), self.preserve_formatting)
                blocks_processed = 1

        # BS fallback (основной)
        cleaned_content = extract_with_beautifulsoup(result.html or "", site_specific=True, url=url)
        if llm_content and len(llm_content) > len(cleaned_content):
            cleaned_content = llm_content  # LLM если лучше

        # Валидация (мягкая)
        if not validate_text_content(cleaned_content, min_length=100, min_letters_ratio=0.15):
            return self._error_response(url, f"Too short: {len(cleaned_content)} chars.")

        metadata = extract_metadata(result.html or "", url)
        logger.info(f"✅ Success: {len(cleaned_content)} chars (attempt {attempt})")

        return {
            "url": url,
            "status_code": getattr(result, 'status_code', 200),
            "title": metadata["title"],
            "description": metadata["description"],
            "keywords": metadata["keywords"],
            "content": cleaned_content,
            "content_length": len(cleaned_content),
            "links": metadata["links"],
            "extraction_method": "LLM" if llm_content else "BS",
            "blocks_processed": blocks_processed,
            "success": True,
        }

    def get_page_info_sync(self, url: str, use_llm: Optional[bool] = None) -> Dict[str, Any]:
        return run_coro_as_sync(self.get_page_info(url, use_llm))

    def scrape_page(self, url: str, clean_html: bool = True, use_llm: Optional[bool] = None) -> Optional[str]:
        page_info = self.get_page_info_sync(url, use_llm)
        if not page_info["success"]:
            self.logger.error(f"Failed: {page_info.get('error_message', 'Unknown')}")
            return None
        return advanced_text_cleaning(page_info["content"], self.preserve_formatting) if clean_html else page_info["content"]

    def _error_response(self, url: str, error: str) -> Dict[str, Any]:
        logger.error(error)
        return {
            "url": url, "success": False, "error_message": error, "status_code": 0, "content": "",
            "content_length": 0, "title": "", "description": "", "keywords": "", "links": [],
            "extraction_method": "error", "blocks_processed": 0,
        }

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        logger.info("Scraper closed.")
        return False


# Тесты: Сначала Habr, потом Вики
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logger_test = logging.getLogger(__name__)

    # Тест Habr
    print("\n🕷️ Testing Habr (delay=10s)...")
    with SimpleScraperService(logger=logger_test, js_delay=10.0) as scraper:
        url_habr = "https://habr.com/ru/articles/951488/"
        text_habr = scraper.scrape_page(url_habr)
        if text_habr:
            print(f"✅ Habr success! Length: {len(text_habr)} chars")
            print(f"Sample: {text_habr[:200]}...")
            if len(text_habr) > 10000:
                print("🎉 Full Habr article!")
                with open("habr_951488.txt", "w", encoding="utf-8") as f:
                    f.write(text_habr)
                print("💾 Saved to 'habr_951488.txt'")
            else:
                print("⚠️ Habr partial.")
            print(text_habr[:1000])  # Печать для короткого
        else:
            print("❌ Habr failed.")

    # Тест Википедии
    print("\n🕷️ Testing Wikipedia (delay=10s)...")
    with SimpleScraperService(logger=logger_test, js_delay=10.0) as scraper:
        url_wiki = "https://ru.wikipedia.org/wiki/Кошка"
        text_wiki = scraper.scrape_page(url_wiki)
        if text_wiki:
            print(f"✅ Wiki success! Length: {len(text_wiki)} chars")
            print(f"Sample: {text_wiki[:200]}...")
            if len(text_wiki) > 15000:
                print("🎉 Full Wiki article!")
                with open("wiki_koshka.txt", "w", encoding="utf-8") as f:
                    f.write(text_wiki)
                print("💾 Saved to 'wiki_koshka.txt'")
            else:
                print("⚠️ Wiki partial.")
            print(text_wiki[:1000])  # Печать для отладки
        else:
            print("❌ Wiki failed.")
