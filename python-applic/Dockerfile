FROM python:3.11-bullseye

ENV PYTHONUTF8=1
WORKDIR /app

COPY requirements.txt ./

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libnss3 libx11-6 libxcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxrandr2 libxss1 \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    curl jq bash procps dos2unix file \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --upgrade pip \
    # Смена pip mirror на более быстрый
    && pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# Установка CPU-only PyTorch ПЕРВЫМ
RUN pip install --no-cache-dir torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

RUN pip install --no-cache-dir playwright \
    && python -m playwright install chromium

COPY . .

RUN dos2unix start.sh main.py requirements.txt Dockerfile 2>/dev/null || true \
    && chmod +x start.sh \
    && mkdir -p /app/prefect

EXPOSE 4200
CMD ["bash", "start.sh"]
