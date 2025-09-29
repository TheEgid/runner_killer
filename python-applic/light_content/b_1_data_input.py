from prefect import task # type: ignore
from models import LightTask
from services.google_sheets import GoogleSheetsService


class LightDataInputStep:
    def __init__(self, sheets_service: GoogleSheetsService):
        self.sheets_service = sheets_service

    @task(retries=3, retry_delay_seconds=10)
    def read_light_tasks(self, spreadsheet_id: str, sheet_name: str) -> list[LightTask]:
        data = self.sheets_service.read_sheets(spreadsheet_id, sheet_name)
        data = data if isinstance(data, list) else [data]

        return [
            LightTask(
                status=item.get("status", ""),
                url=item.get("url", "")
            )
            for item in data[:3450]
        ]
