import json
import logging
from pathlib import Path
from typing import Any, Optional, Type, TypeVar
from dataclasses import asdict, is_dataclass
from dacite import from_dict, Config as DaciteConfig # type: ignore

T = TypeVar('T')


class Cache:
    """Файловый кэш для JSON-сериализуемых данных с поддержкой дата-классов через dacite."""

    def __init__(self, base_path: str = "pipeline_cache", logger: Optional[logging.Logger] = None):
        self.base_path = Path(base_path)
        self.base_path.mkdir(exist_ok=True)
        self.logger = logger or logging.getLogger(self.__class__.__name__)

    def _file(self, key: str) -> Path:
        return self.base_path / f"{key}.json"

    def set(self, key: str, value: Any) -> None:
        """Сохраняет объект (обычный или дата-класс) в кэш.
        Для дата-классов добавляет служебное поле '__class__' для восстановления.
        """
        file = self._file(key)
        try:
            if is_dataclass(value):
                data = asdict(value)
                data["__class__"] = f"{value.__class__.__module__}.{value.__class__.__qualname__}"
            else:
                data = value
            with open(file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except (TypeError, ValueError) as e:
            self.logger.error(f"Ошибка сериализации для ключа {key}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Ошибка при сохранении {key}: {e}")
            raise

    def get(self, key: str, dacite_config: Optional[DaciteConfig] = None) -> Optional[T]:
        """Загружает объект из кэша.
        Если в данных есть '__class__' → восстанавливает дата-класс через dacite.
        По умолчанию включает auto-cast типов (str, int, float, bool).
        """
        file = self._file(key)
        if not file.exists():
            return None

        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, dict) and "__class__" in data:
                class_path = data.pop("__class__")
                module_name, class_name = class_path.rsplit(".", 1)
                module = __import__(module_name, fromlist=[class_name])
                data_class: Type[T] = getattr(module, class_name)

                # ✅ если не передан dacite_config — используем cast по умолчанию
                config = dacite_config or DaciteConfig(cast=[str, int, float, bool])
                return from_dict(data_class=data_class, data=data, config=config)

            return data
        except json.JSONDecodeError as e:
            self.logger.error(f"Ошибка декодирования JSON для ключа {key}: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Ошибка при загрузке {key}: {e}")
            return None

    def dump_markdown(self, key: str, value: Any, file_suffix: str = ".md") -> None:
            """Сохраняет объект (обычный или дата-класс) в кэш в формате Markdown.
            Для словарей и дата-классов преобразует данные в таблицу Markdown.
            """
            file = self.base_path / f"{key}{file_suffix}"
            markdown_content = ""
            try:
                if is_dataclass(value):
                    data = asdict(value)
                elif isinstance(value, dict):
                    data = value
                else:
                    data = {"value": value}  # Оборачиваем простые типы в словарь

                headers = "| " + " | ".join(data.keys()) + " |"
                separator = "|-" + "-|" * len(data.keys())

                values = "| " + " | ".join(str(v) for v in data.values()) + " |"

                markdown_content = f"{headers}\n{separator}\n{values}"

                with open(file, "w", encoding="utf-8") as f:
                    f.write(markdown_content)
                self.logger.info(f"Сохранено в Markdown: {file}")

            except Exception as e:
                self.logger.error(f"Ошибка при сохранении в Markdown для ключа {key}: {e}")
                raise
