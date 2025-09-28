import os
from typing import Dict, List, Union
import gspread # type: ignore
from google.oauth2.service_account import Credentials # type: ignore

from models import LightTask

class GoogleSheetsService:
    def __init__(self):
        self.credentials = self._setup_credentials()
        self.client = gspread.authorize(self.credentials)

    def _setup_credentials(self):
        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive"
        ]

        creds_info = {
            "type": "service_account",
            "project_id": os.getenv("GOOGLE_PROJECT_ID"),
            "private_key": os.getenv("GOOGLE_PRIVATE_KEY").replace('\\n', '\n'),
            "client_email": os.getenv("GOOGLE_CLIENT_EMAIL"),
            "token_uri": "https://oauth2.googleapis.com/token",
        }

        return Credentials.from_service_account_info(creds_info, scopes=scope)

    def read_sheet(self, spreadsheet_id: str, sheet_name: str) -> Dict:
        sheet = self.client.open_by_key(spreadsheet_id).worksheet(sheet_name)
        records = sheet.get_all_records()
        return records[0] if records else {}

    def read_sheets(self, spreadsheet_id: str, sheet_name: str) -> List[Dict]:
        try:
            sheet = self.client.open_by_key(spreadsheet_id).worksheet(sheet_name)
            records = sheet.get_all_records()
            print(f"📊 Получено записей: {len(records)}")

            if not records:
                print("⚠️ Лист пуст или нет данных")
                return []

            return records if isinstance(records, list) else [records]

        except Exception as e:
            print(f"❌ Ошибка чтения Google Sheets: {e}")
            return []

        #  def update_results(self, spreadsheet_id: str, results: Dict):
        #         sheet = self.client.open_by_key(spreadsheet_id).worksheet("Рабочий")

        #         # Находим строку по номеру
        #         row_num = self._find_row_by_number(sheet, results["Номер"])

        #         if row_num:
        #             # Обновляем ячейки
        #             updates = []
        #             for col, value in results.items():
        #                 col_num = self._get_column_number(sheet, col)
        #                 if col_num:
        #                     updates.append({
        #                         'range': f'{self._number_to_letter(col_num)}{row_num}',
        #                         'values': [[value]]
        #                     })

        #             sheet.batch_update(updates)

    def update_task_status(self, spreadsheet_id: str, sheet_name: str, url: str, new_status: str) -> bool:
        try:
            sheet = self.client.open_by_key(spreadsheet_id).worksheet(sheet_name)
            records = sheet.get_all_records()

            if not records:
                print("⚠️ Лист пуст")
                return False

            headers = [h.lower() for h in sheet.row_values(1)]

            if "url" not in headers or "status" not in headers:
                print("❌ В таблице нет колонок 'url' или 'status'")
                return False

            status_col = headers.index("status") + 1

            for i, record in enumerate(records, start=2):  # начинаем с 2 строки
                # ключи в нижний регистр для надёжности
                record = {k.lower(): v for k, v in record.items()}

                if record.get("url") == url:
                    if record.get("status") != new_status:
                        sheet.update_cell(i, status_col, new_status)
                        print(f"✅ Обновлен статус для {url}: {new_status}")
                    return True

            print(f"⚠️ URL не найден в таблице: {url}")
            return False

        except Exception as e:
            print(f"❌ Ошибка обновления статуса для {url}: {type(e).__name__}: {e}")
            return False

    def add_tasks_if_not_exists(self, spreadsheet_id: str, sheet_name: str, tasks: List[LightTask]) -> List[LightTask]:
        """
        Проверяет наличие URL во втором столбце и добавляет отсутствующие задачи в конец таблицы.

        Args:
            spreadsheet_id: ID таблицы Google Sheets
            sheet_name: Название листа
            tasks: Список объектов LightTask для добавления

        Returns:
            list: Список добавленных задач LightTask
        """
        try:
            sheet = self.client.open_by_key(spreadsheet_id).worksheet(sheet_name)

            # Получаем все значения из второго столбца (URL)
            url_column_values = sheet.col_values(2)

            # Находим задачи, URL которых еще нет в таблице
            tasks_to_add = [task for task in tasks if task.url not in url_column_values]

            if not tasks_to_add:
                print("⚠️ Все задачи уже существуют в таблице")
                return []

            # Проверяем, не превысим ли мы лимит строк
            current_row_count = len(url_column_values)
            max_rows = 20000

            if current_row_count + len(tasks_to_add) > max_rows:
                # Вычисляем, сколько задач мы можем добавить
                can_add_count = max_rows - current_row_count
                tasks_to_add = tasks_to_add[:can_add_count]
                print(f"⚠️ Превышен лимит строк. Добавлено только {can_add_count} задач")

            # Подготавливаем данные для добавления
            data = []
            for task in tasks_to_add:
                # Добавляем статус в первой колонке и URL во второй
                data.append([task.status, task.url])
                print(f"✅ Задача будет добавлена: {task.status} - {task.url}")

            # Добавляем все данные одним запросом
            sheet.append_rows(data, value_input_option='USER_ENTERED')

            print(f"✅ Добавлено {len(tasks_to_add)} новых задач")
            return tasks_to_add

        except Exception as e:
            print(f"❌ Ошибка при добавлении задач: {type(e).__name__}: {e}")
            return []
