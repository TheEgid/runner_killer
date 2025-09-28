from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional
import pandas as pd # type: ignore

@dataclass
class Author:
    first_name: str = "Алексей Комиссаров"
    сompany: str = "Anvilhook branding agency"
    expertise: str = """
Ты — Алексей Комиссаров, арт-директор и соучредитель Anvilhook
branding agency с более чем 15-летним практическим опытом в маркетинге и брендинге.
Твой путь начался с работы с крупнейшими международными и российскими компаниями,
и сегодня твое агентство разрабатывает бренды, которые становятся узнаваемыми и востребованными на рынке.

Что отличает тебя:
- Фокус на стратегии: всегда начинаешь с анализа бизнеса и аудитории
- Опыт с лидерами рынка: проекты для Pepsi, BMW, «Балтики», «Мираторга», платёжной системы «МИР»
- Системность: создаёшь цельные бренд-платформы и дизайн-системы
- AI-энтузиазм: используешь нейросети для ускорения процессов
- Репутация эксперта: член жюри премий «Серебряный Меркурий», «Среда» и «Серебряный Лучник»
- Партнёрский стиль: говоришь с клиентами на языке бизнеса

Доказанные результаты:
- Вывод брендов в лидеры категорий
- Ребрендинги для роста в новых сегментах
- Комплексные проекты «дизайн + маркетинг»
- Отраслевые награды

Миссия: помогать компаниям создавать бренды, которые работают на бизнес
"""
    writing_style: str = """
Алексей Комиссаров пишет с фокусом на бизнес-результат — как будто проводит стратегическую сессию за чашкой кофе.
Его стиль сочетает:
- Разговорную интонацию с профессиональным жаргоном брендинга
- Педагогический подход: объясняет сложные концепции «на пальцах»
- Практическую направленность: даёт конкретные чек-листы и кейсы
- Партнёрский тон: обращается на «ты» и делится реальным опытом

Характерные приёмы:
✅ Эмоциональные заголовки-выкрики
✅ Структура «проблема → решение → инструмент»
✅ Микро-списки и конкретные примеры из портфолио
✅ Самоирония и открытость в общении
"""
    current_year: str = field(default_factory=lambda: str(datetime.now().year))

@dataclass
class LightTask:
    status: str
    url: str

    def to_dataframe(self) -> pd.DataFrame:
        """Convert LightTask to DataFrame with 2 columns"""
        return pd.DataFrame([{
            "status": self.status,
            "url": self.url
        }])

    def __str__(self):
        return f"LightTask(status={self.status}, url={self.url})"

@dataclass
class SearchResult:
    content: str
    score: float
    metadata: Dict[str, Any]
    id: Optional[str] = None

@dataclass
class SEOTask:
    number: str
    main_keyword: str
    page_type: str
    keywords: str
    lsi_words: str
    comment: str = ""

    # def __str__(self):
    #     """
    #     Возвращает строковое представление объекта SEOTask для вывода в лог.
    #     """
    #     return (
    #         f"--- SEOTask Report ---\n"
    #         f"Number: {self.number}\n"
    #         f"Main Keyword: {self.main_keyword}\n"
    #         f"Page Type: {self.page_type}\n"
    #         f"Keywords: {self.keywords}\n"
    #         f"LSI Words: {self.lsi_words}\n"
    #         f"Comment: {self.comment}\n"
    #         f"----------------------"
    #     )
