import asyncio
import socket
import time
from typing import Dict, Any, Optional, List, Tuple
from urllib.parse import urljoin, urlparse
from prefect.utilities.asyncutils import run_coro_as_sync # type: ignore
from bs4 import BeautifulSoup # type: ignore
import requests # type: ignore
import json
from crawl4ai import  AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode # type: ignore

HAS_CLOUDSCRAPER = False
HAS_DNS_RESOLVER = False

class StructuredHTMLScraper:
    """
    Продвинутый сервис для извлечения структурированного HTML контента с веб-страниц.
    Включает множественные fallback стратегии, проверку доступности доменов и кэширование.
    """

    def __init__(self, logger, headless: bool = True, use_custom_dns: bool = True):
        dns_args = []
        if use_custom_dns:
            dns_args = [
                '--dns-over-https-server=https://1.1.1.1/dns-query',  # Cloudflare DNS
            ]

        self.logger = logger
        # Конфигурация браузера с дополнительными параметрами
        self.browser_config = BrowserConfig(
            browser_type="chromium",
            headless=headless,
            verbose=False,
            extra_args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--ignore-certificate-errors',
                '--ignore-ssl-errors',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-images',  # Отключаем загрузку изображений для ускорения
                *dns_args
            ]
        )

        # Статистика
        self.stats = {
            'total_requests': 0,
            'successful': 0,
            'failed': 0,
            'fallback_used': 0,
        }


    def _check_domain_availability(self, url: str) -> Tuple[bool, str]:
        """
        Проверяет доступность домена несколькими способами.

        Returns:
            tuple[bool, str]: (доступен ли домен, сообщение об ошибке)
        """
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or parsed.path

            # Удаляем www. для проверки
            domain = domain.replace('www.', '')

            # Метод 1: Проверка через socket
            try:
                socket.gethostbyname(domain)
                self.logger.info(f"✅ Домен {domain} успешно разрешен через socket")
                return True, ""
            except socket.gaierror as e:
                self.logger.warning(f"⚠️ Socket не может разрешить {domain}: {e}")

            # # Метод 2: Проверка через DNS resolver (если установлен)
            # if HAS_DNS_RESOLVER:
            #     try:
            #         resolver = dns.resolver.Resolver()
            #         resolver.timeout = 5
            #         resolver.lifetime = 5
            #         resolver.nameservers = ['8.8.8.8', '1.1.1.1', '77.88.8.8', '9.9.9.9']
            #         answers = resolver.resolve(domain, 'A')
            #         if answers:
            #             self.logger.info(f"✅ DNS записи найдены для {domain}")
            #             return True, ""
            #     except dns.resolver.NXDOMAIN:
            #         self.logger.warning(f"⚠️ Домен {domain} не существует (NXDOMAIN)")
            #         return False, f"Домен {domain} не существует"
            #     except dns.resolver.NoNameservers:
            #         self.logger.warning(f"⚠️ Все DNS-серверы вернули ошибку для {domain}")
            #     except dns.resolver.Timeout:
            #         self.logger.warning(f"⚠️ Таймаут DNS-запроса для {domain}")
            #     except Exception as e:
            #         self.logger.warning(f"⚠️ DNS resolver ошибка для {domain}: {e}")

            # Метод 3: HTTP проверка через requests
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                response = requests.head(url, timeout=5, allow_redirects=True, headers=headers, verify=False)
                if response.status_code < 500:
                    self.logger.info(f"✅ HTTP проверка успешна для {url} (код: {response.status_code})")
                    return True, ""
            except Exception as e:
                self.logger.warning(f"⚠️ HTTP проверка не удалась для {url}: {e}")

            return False, f"Домен {domain} недоступен по всем методам проверки"

        except Exception as e:
            return False, f"Ошибка проверки домена: {e}"

    def validate_and_fix_url(self, url: str) -> Optional[str]:
        """
        Проверяет и пытается исправить URL, пробуя разные варианты.
        """
        # Базовая нормализация
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Проверяем разные варианты URL
        variants = [
            url,
            url.replace('https://', 'http://'),
            f"https://www.{url.replace('https://', '').replace('http://', '').replace('www.', '')}",
            f"http://www.{url.replace('https://', '').replace('http://', '').replace('www.', '')}",
        ]

        for variant in variants:
            is_available, _ = self._check_domain_availability(variant)
            if is_available:
                self.logger.info(f"✅ Найден рабочий вариант URL: {variant}")
                return variant

        # Используем web.archive.org как последний резерв
        self.logger.warning(f"⚠️ Не найден рабочий вариант для {url}, пробуем Internet Archive")
        archive_url = f"https://web.archive.org/web/2/{url}"
        return archive_url

    async def _fallback_scraping(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Fallback методы скрапинга через cloudscraper и requests.
        """
        self.logger.info(f"🔄 Используем fallback методы для {url}")

        # # Метод 1: cloudscraper (если установлен)
        # if HAS_CLOUDSCRAPER:
        #     try:
        #         scraper = cloudscraper.create_scraper(
        #             browser={
        #                 'browser': 'chrome',
        #                 'platform': 'windows',
        #                 'desktop': True
        #             },
        #             delay=3
        #         )

        #         response = scraper.get(url, timeout=15)
        #         if response.status_code == 200 and response.text:
        #             html = response.text
        #             self.logger.info(f"✅ Cloudscraper успешно получил контент для {url}")
        #             self.stats['fallback_used'] += 1
        #             return self._process_html(html, url, method="cloudscraper")

        #     except Exception as e:
        #         self.logger.warning(f"⚠️ Cloudscraper ошибка: {e}")

        # Метод 2: requests с разными user-agents
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]

        for user_agent in user_agents:
            try:
                headers = {
                    'User-Agent': user_agent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                }

                session = requests.Session()
                response = session.get(url, headers=headers, timeout=15, verify=False, allow_redirects=True)

                if response.status_code == 200 and response.text:
                    html = response.text
                    self.logger.info(f"✅ Requests успешно получил контент для {url}")
                    self.stats['fallback_used'] += 1
                    return self._process_html(html, url, method="requests")

            except Exception as e:
                self.logger.warning(f"⚠️ Requests ошибка с user-agent {user_agent[:30]}...: {e}")
                continue

        self.logger.error(f"❌ Все fallback методы не сработали для {url}")
        return None

    def _process_html(self, html: str, url: str, method: str = "crawl4ai") -> Dict[str, Any]:
        """
        Обрабатывает HTML контент независимо от источника получения.
        """
        if not html or len(html.strip()) < 100:
            self.logger.warning(f"⚠️ Слишком короткий или пустой HTML для {url}")
            return None

        structured_html = self._extract_main_content_with_tags(html)
        metadata = self._extract_metadata(html, url)
        page_structure = self.extract_page_structure(html)
        seo_metrics = self.analyze_seo_metrics(html, url)

        result = {
            "url": url,
            "html_content": structured_html,
            "title": metadata.get("title", ""),
            "description": metadata.get("description", ""),
            "keywords": metadata.get("keywords", ""),
            "links": metadata.get("links", []),
            "content_length": len(structured_html),
            "structure": page_structure,
            "seo_metrics": seo_metrics,
            "success": True,
            "method": method,
            "timestamp": int(time.time())
        }

        return result

    async def get_structured_html(self, url: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """
        Асинхронно извлекает структурированный HTML контент с множественными fallback стратегиями.
        """
        self.stats['total_requests'] += 1
        self.logger.info(f"🚀 Начинаем извлечение структурированного HTML для URL: {url}")

        # Валидируем и исправляем URL
        fixed_url = self.validate_and_fix_url(url)
        if not fixed_url:
            self.logger.error(f"❌ Не удалось валидировать URL: {url}")
            self.stats['failed'] += 1
            return None

        # Проверяем доступность домена
        is_available, error_msg = self._check_domain_availability(fixed_url)
        if not is_available:
            self.logger.warning(f"⚠️ Домен недоступен: {error_msg}, пробуем fallback")
            result = await self._fallback_scraping(fixed_url)
            if result:
                self.stats['successful'] += 1
            else:
                self.stats['failed'] += 1
            return result

        # Основной цикл попыток с Crawl4AI
        for attempt in range(1, max_retries + 1):
            try:
                self.logger.info(f"📡 Попытка {attempt}/{max_retries} для {fixed_url}")

                async with AsyncWebCrawler(config=self.browser_config) as crawler:
                    crawler_config = CrawlerRunConfig(
                        cache_mode=CacheMode.BYPASS,
                        magic=False,
                        delay_before_return_html=2.0,
                    )

                    result = await crawler.arun(fixed_url, config=crawler_config)

                    if result and result.success and result.html:
                        self.logger.info(f"✅ Crawl4AI успешно получил контент для {fixed_url}")
                        processed = self._process_html(result.html, fixed_url, method="crawl4ai")
                        if processed:
                            self.stats['successful'] += 1
                            return processed
                    else:
                        error_msg = result.error_message if result else "Неизвестная ошибка"
                        self.logger.warning(f"⚠️ Попытка {attempt} не удалась: {error_msg}")

            except Exception as e:
                error_str = str(e)
                if any(err in error_str for err in ["ERR_NAME_NOT_RESOLVED", "ERR_CONNECTION_REFUSED", "ERR_TIMED_OUT"]):
                    self.logger.warning(f"⚠️ Сетевая ошибка на попытке {attempt}: {error_str[:100]}")
                    if attempt == max_retries:
                        # Последняя попытка - используем fallback
                        result = await self._fallback_scraping(fixed_url)
                        if result:
                            self.stats['successful'] += 1
                        else:
                            self.stats['failed'] += 1
                        return result
                else:
                    self.logger.error(f"❌ Непредвиденная ошибка: {e}")

                # Экспоненциальная задержка между попытками
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)

        # Если все попытки Crawl4AI не удались, пробуем fallback
        self.logger.warning(f"⚠️ Все попытки Crawl4AI не удались для {fixed_url}, используем fallback")
        result = await self._fallback_scraping(fixed_url)
        if result:
            self.stats['successful'] += 1
        else:
            self.stats['failed'] += 1
        return result

    def get_structured_html_sync(self, url: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """
        Синхронная обертка для get_structured_html.
        """
        try:
            return run_coro_as_sync(self.get_structured_html(url, max_retries))
        except Exception as e:
            self.logger.error(f"❌ Ошибка в синхронной обертке: {e}")
            return None

    def extract_page_structure(self, html_content: str) -> Dict[str, Any]:
        """
        Расширенное извлечение структуры страницы.
        """
        structure = {
            'headers': [],
            'meta_description': None,
            'title': None,
            'images_count': 0,
            'links_count': 0,
            'word_count': 0,
            'sections': [],
            'tables_count': 0,
            'lists_count': 0,
            'forms_count': 0,
            'videos_count': 0,
            'paragraphs_count': 0
        }

        if not html_content:
            return structure

        try:
            soup = BeautifulSoup(html_content, 'html.parser')

            # Заголовки с иерархией
            header_hierarchy = []
            for level in range(1, 7):
                tag = f'h{level}'
                headers = soup.find_all(tag)
                for idx, h in enumerate(headers):
                    text = h.get_text(strip=True)
                    if text and len(text) > 1:
                        header_info = {
                            'level': level,
                            'text': text[:200],  # Ограничиваем длину
                            'position': idx,
                            'id': h.get('id', ''),
                            'class': ' '.join(h.get('class', []))
                        }
                        structure['headers'].append(header_info)
                        header_hierarchy.append(header_info)

            # Сортируем заголовки по их появлению в документе
            structure['headers'] = sorted(structure['headers'], key=lambda x: (x['level'], x['position']))

            # Мета-данные
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc:
                structure['meta_description'] = meta_desc.get('content', '')

            # Title
            title = soup.find('title')
            if title:
                structure['title'] = title.get_text(strip=True)

            # Расширенная статистика
            structure['images_count'] = len(soup.find_all('img'))
            structure['links_count'] = len(soup.find_all('a', href=True))
            structure['tables_count'] = len(soup.find_all('table'))
            structure['lists_count'] = len(soup.find_all(['ul', 'ol']))
            structure['forms_count'] = len(soup.find_all('form'))
            structure['videos_count'] = len(soup.find_all(['video', 'iframe']))
            structure['paragraphs_count'] = len(soup.find_all('p'))

            # Подсчет слов
            text = soup.get_text()
            words = text.split()
            structure['word_count'] = len(words)

            # Определение секций/разделов на основе заголовков
            sections = []
            current_section = None
            for header in structure['headers']:
                if header['level'] <= 2:  # h1 и h2 считаем основными разделами
                    if current_section:
                        sections.append(current_section)
                    current_section = {
                        'level': header['level'],
                        'title': header['text'],
                        'subsections': []
                    }
                elif current_section and header['level'] <= 3:  # h3 как подразделы
                    current_section['subsections'].append(header['text'])

            if current_section:
                sections.append(current_section)

            structure['sections'] = sections

        except Exception as e:
            self.logger.error(f"❌ Ошибка при извлечении структуры: {e}")

        return structure

    def analyze_seo_metrics(self, html: str, url: str) -> Dict[str, Any]:
        """
        Анализ SEO параметров страницы.
        """
        metrics = {
            'has_h1': False,
            'h1_count': 0,
            'meta_robots': None,
            'canonical_url': None,
            'og_tags': {},
            'twitter_cards': {},
            'schema_markup': False,
            'internal_links': 0,
            'external_links': 0,
            'alt_texts_missing': 0,
            'page_speed_hints': {}
        }

        try:
            soup = BeautifulSoup(html, 'html.parser')
            parsed_url = urlparse(url)
            domain = parsed_url.netloc

            # H1 анализ
            h1_tags = soup.find_all('h1')
            metrics['h1_count'] = len(h1_tags)
            metrics['has_h1'] = metrics['h1_count'] > 0

            # Robots meta
            robots = soup.find('meta', attrs={'name': 'robots'})
            if robots:
                metrics['meta_robots'] = robots.get('content', '')

            # Canonical URL
            canonical = soup.find('link', attrs={'rel': 'canonical'})
            if canonical:
                metrics['canonical_url'] = canonical.get('href', '')

            # Open Graph теги
            for og in soup.find_all('meta', property=lambda x: x and x.startswith('og:')):
                prop = og.get('property', '').replace('og:', '')
                metrics['og_tags'][prop] = og.get('content', '')

            # Twitter Cards
            for tw in soup.find_all('meta', attrs={'name': lambda x: x and x.startswith('twitter:')}):
                name = tw.get('name', '').replace('twitter:', '')
                metrics['twitter_cards'][name] = tw.get('content', '')

            # Schema.org разметка
            scripts = soup.find_all('script', type='application/ld+json')
            metrics['schema_markup'] = len(scripts) > 0

            # Анализ ссылок
            for link in soup.find_all('a', href=True):
                href = link['href']
                if href.startswith(('http://', 'https://')):
                    if domain in href:
                        metrics['internal_links'] += 1
                    else:
                        metrics['external_links'] += 1
                elif href.startswith('/'):
                    metrics['internal_links'] += 1

            # Проверка alt текстов у изображений
            images = soup.find_all('img')
            for img in images:
                if not img.get('alt'):
                    metrics['alt_texts_missing'] += 1

            # Page speed подсказки
            metrics['page_speed_hints'] = {
                'total_images': len(images),
                'images_without_lazy_loading': len([img for img in images if not img.get('loading') == 'lazy']),
                'inline_styles_count': len(soup.find_all(style=True)),
                'inline_scripts_count': len(soup.find_all('script', src=False))
            }

        except Exception as e:
            self.logger.error(f"❌ Ошибка при анализе SEO метрик: {e}")

        return metrics

    def _extract_main_content_with_tags(self, html: str) -> str:
        """
        Извлекает основной контент из HTML, сохраняя теги и структуру.
        """
        if not html:
            return ""

        try:
            soup = BeautifulSoup(html, 'html.parser')

            # Удаляем ненужные элементы
            for element in soup(['script', 'style', 'noscript', 'meta', 'link', 'comment']):
                element.decompose()

            # Удаляем элементы по селекторам
            unwanted_selectors = [
                'nav', 'footer', 'aside', 'header',
                '.navbar', '.navigation', '.nav',
                '.footer', '.header',
                '.sidebar', '.widget', '.menu',
                '.advertisement', '.ads', '.ad-container',
                '.popup', '.modal', '.overlay',
                '.cookie', '.banner',
                '#comments', '.comments'
            ]

            for selector in unwanted_selectors:
                for element in soup.select(selector):
                    element.decompose()

            # Попытка найти основной контентный блок
            main_content = None
            content_selectors = [
                'main',
                'article',
                '[role="main"]',
                '#content',
                '.content',
                '.post',
                '.entry',
                '#main-content',
                '.main-content',
                '.article-content',
                '.post-content',
                '.entry-content',
                '.page-content',
                '.text-content',
                '[itemprop="articleBody"]'
            ]

            for selector in content_selectors:
                elements = soup.select(selector)
                if elements:
                    # Выбираем элемент с наибольшим количеством текста
                    main_element = max(elements, key=lambda x: len(x.get_text(strip=True)))
                    if len(main_element.get_text(strip=True)) > 100:
                        main_content = main_element
                        break

            # Если не нашли по селекторам, используем body
            if not main_content:
                if soup.body:
                    main_content = soup.body
                else:
                    return str(soup)

            # Очищаем атрибуты для уменьшения размера
            for tag in main_content.find_all(True):
                # Сохраняем только важные атрибуты
                allowed_attrs = ['href', 'src', 'alt', 'title', 'id', 'class']
                tag.attrs = {key: value for key, value in tag.attrs.items() if key in allowed_attrs}

            return str(main_content)

        except Exception as e:
            self.logger.error(f"❌ Ошибка при извлечении основного контента: {e}")
            return html

    def _extract_metadata(self, html: str, url: str) -> Dict[str, Any]:
        """
        Извлекает расширенные метаданные из HTML.
        """
        metadata = {
            'title': '',
            'description': '',
            'keywords': '',
            'author': '',
            'published_date': '',
            'modified_date': '',
            'language': '',
            'links': [],
            'emails': [],
            'phones': []
        }

        try:
            soup = BeautifulSoup(html, 'html.parser')

            # Title
            title = soup.title
            metadata['title'] = title.get_text(strip=True) if title else ""

            # Description
            desc = soup.find('meta', attrs={'name': 'description'})
            metadata['description'] = desc.get('content', '') if desc else ""

            # Keywords
            kw = soup.find('meta', attrs={'name': 'keywords'})
            metadata['keywords'] = kw.get('content', '') if kw else ""

            # Author
            author = soup.find('meta', attrs={'name': 'author'})
            metadata['author'] = author.get('content', '') if author else ""

            # Dates
            published = soup.find('meta', property='article:published_time')
            metadata['published_date'] = published.get('content', '') if published else ""

            modified = soup.find('meta', property='article:modified_time')
            metadata['modified_date'] = modified.get('content', '') if modified else ""

            # Language
            lang_tag = soup.find('html')
            if lang_tag:
                metadata['language'] = lang_tag.get('lang', '')

            # Links (уникальные и абсолютные)
            links = set()
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                try:
                    absolute_url = urljoin(url, href)
                    if absolute_url.startswith(('http://', 'https://')):
                        links.add(absolute_url)
                except:
                    continue
            metadata['links'] = list(links)[:100]  # Ограничиваем количество

            # Emails (базовый поиск)
            import re
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            text = soup.get_text()
            emails = re.findall(email_pattern, text)
            metadata['emails'] = list(set(emails))[:10]

            # Телефоны (базовый поиск)
            phone_pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}'
            phones = re.findall(phone_pattern, text)
            metadata['phones'] = list(set(phones))[:10]

        except Exception as e:
            self.logger.error(f"❌ Ошибка при извлечении метаданных: {e}")

        return metadata

    def scrape_page(self, url: str, max_retries: int = 3) -> Optional[str]:
        """
        Основной метод для извлечения структурированного HTML.
        """
        result = self.get_structured_html_sync(url, max_retries)
        if result and result.get('success'):
            return result.get('html_content')
        return None

    def scrape_page_with_structure(self, url: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """
        Метод для извлечения структурированного HTML вместе со структурой страницы.
        """
        return self.get_structured_html_sync(url, max_retries)

    def get_stats(self) -> Dict[str, Any]:
        """
        Возвращает статистику работы скрапера.
        """
        stats = self.stats.copy()
        stats['success_rate'] = (
            stats['successful'] / stats['total_requests'] * 100
            if stats['total_requests'] > 0 else 0
        )
        return stats

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Выводим статистику при закрытии
        stats = self.get_stats()
        self.logger.info(f"📊 Статистика скрапера: {json.dumps(stats, indent=2)}")
        self.logger.info("StructuredHTMLScraper closed.")
