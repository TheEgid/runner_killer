FROM python:3.11-bullseye

ENV PYTHONUTF8=1
WORKDIR /app

COPY requirements.txt ./

RUN rm -f /etc/apt/sources.list.d/debian.sources || true \
    && echo "deb http://mirrors.aliyun.com/debian bullseye main contrib non-free non-free-firmware" > /etc/apt/sources.list \
    && echo "deb-src http://mirrors.aliyun.com/debian bullseye main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian-security bullseye-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb-src http://mirrors.aliyun.com/debian-security bullseye-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian bullseye-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb-src http://mirrors.aliyun.com/debian bullseye-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com/debian|g' /etc/apt/sources.list \
    && sed -i 's|http://security.debian.org|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list \
    && sed -i 's|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list || true

# Обновление пакетов и установка системных зависимостей
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends \
        libglib2.0-0 libnss3 libx11-6 libxcb1 libxcomposite1 \
        libxdamage1 libxext6 libxfixes3 libxrandr2 libxss1 \
        libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Установка утилит
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends \
        aria2 wget curl jq bash procps dos2unix file iproute2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Обновление pip и настройка mirror
RUN pip install --no-cache-dir --upgrade pip \
    && pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# Установка CPU-only PyTorch ПЕРВЫМ (с TUNA index)
# RUN pip install --no-cache-dir torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu
RUN URL="https://download.pytorch.org/whl/cpu/torch-2.8.0%2Bcpu-cp311-cp311-manylinux_2_28_x86_64.whl" \
    && echo "📥 Downloading PyTorch..." \
    && aria2c -x 16 -s 16 --dir=/app "$URL" \
    && pip install --no-cache-dir /app/torch-2.8.0+cpu-cp311-cp311-manylinux_2_28_x86_64.whl \
    && rm -f /app/torch-2.8.0+cpu-cp311-cp311-manylinux_2_28_x86_64.whl

RUN pip install --no-cache-dir -r requirements.txt

ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright

RUN pip install --no-cache-dir playwright && \
    python -m playwright install chromium

COPY . .

RUN dos2unix start.sh main.py requirements.txt Dockerfile 2>/dev/null || true \
    && chmod +x start.sh \
    && mkdir -p /app/prefect

EXPOSE 4200
CMD ["bash", "start.sh"]
