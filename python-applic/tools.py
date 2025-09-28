import json
import re
from typing import List

from models import LightTask

def create_light_tasks_from_urls(urls: List[str], default_status: str = "pending") -> List[LightTask]:
    """
    Создает список объектов LightTask из списка URL

    Args:
        urls: Список URL для преобразования в задачи
        default_status: Статус по умолчанию для новых задач

    Returns:
        Список объектов LightTask
    """
    return [LightTask(status=default_status, url=url) for url in urls]


def extract_json(text: str) -> dict:
    if not text or not isinstance(text, str):
        return {}
    text = text.strip()

    # Patterns to search for JSON, with code blocks first
    patterns = [
        r'```json\s*(.*?)\s*```',  # Code block with json
        r'```\s*(.*?)\s*```',      # Generic code block
        r'(\{.*\})'                 # Standalone JSON object
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        for match in matches:
            # Try each match, starting with the longest (likely the most complete)
            matches_sorted = sorted(matches, key=len, reverse=True)
            for candidate in matches_sorted:
                candidate = candidate.strip()
                if candidate.startswith('{') and candidate.endswith('}'):
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        continue

    # Fallback: try parsing the entire text as JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}
