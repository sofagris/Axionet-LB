FROM python:3.12.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    AX_LB_DATA_DIR=/var/lib/ax-lb \
    AXIONET_APPS_DIR=/var/lib/ax-lb/packages/apps \
    AXIONET_APPS_SEED_DIR=/opt/axionet/packages/apps \
    AXIONET_STORE_INDEX=/opt/axionet/packages/store/index.v1.json \
    AXIONET_SCHEMAS_DIR=/opt/axionet/docs/schemas

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl iproute2 util-linux ethtool \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml ./
COPY backend/app ./app
COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY packages/apps /opt/axionet/packages/apps
COPY packages/store /opt/axionet/packages/store
COPY docs/schemas /opt/axionet/docs/schemas

RUN pip install --upgrade pip \
    && pip install .

RUN mkdir -p /var/lib/ax-lb /run/ax-lb

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/v1/system/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
