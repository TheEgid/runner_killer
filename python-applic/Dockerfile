FROM python:3.11-slim

ENV PYTHONUTF8=1
WORKDIR /app

# Системные библиотеки для Chromium + утилиты
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgobject-2.0-0 libnspr4 libnss3 libsm6 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libexpat1 libxcb1 \
    libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxrandr2 libgbm1 libcairo2 libpango-1.0-0 libasound2 \
    libatspi2.0-0 libxkbcommon0 curl jq bash procps dos2unix file \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --upgrade pip

# pip install CPU-only PyTorch
RUN pip install --no-cache-dir torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu

# Установка зависимостей Python
COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

# Playwright + Chromium
RUN pip install --no-cache-dir playwright \
    && python -m playwright install-deps \
    && python -m playwright install chromium

# Копируем проект
COPY . .

# Форматы файлов и права
RUN dos2unix start.sh main.py requirements.txt Dockerfile 2>/dev/null || true \
    && chmod +x start.sh \
    && mkdir -p /app/prefect

EXPOSE 4200
CMD ["bash", "start.sh"]
