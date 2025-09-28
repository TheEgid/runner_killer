FROM postgres:17.5-bookworm

USER root

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev gcc python3-dev pgloader \
    python3 python3-pip python3-virtualenv \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

RUN virtualenv /opt/venv

RUN /opt/venv/bin/pip install --no-cache-dir jinja2
RUN /opt/venv/bin/pip install --no-cache-dir db-to-sqlite[postgresql]

ENV PATH="/opt/venv/bin:$PATH"

COPY \
    ./render_template.py \
    ./import.load.tpl \
    ./migrate.py \
    ./set_pg_logs.sh \
    ./docker-entrypoint.sh \
    /

RUN chmod +x /render_template.py /docker-entrypoint.sh /set_pg_logs.sh /migrate.py && \
    dos2unix /render_template.py /import.load.tpl /set_pg_logs.sh /docker-entrypoint.sh /migrate.py

RUN mkdir -p /docker-entrypoint-initdb.d && mv /set_pg_logs.sh /docker-entrypoint-initdb.d/

RUN mkdir -p /app && chown -R postgres:postgres /app

ENV TZ='Europe/Moscow'

ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["postgres"]
