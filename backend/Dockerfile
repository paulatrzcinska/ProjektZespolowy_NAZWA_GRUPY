# Warstwa APP: obraz backendu FastAPI dla ECS Fargate.
# Kontekst budowania to katalog główny repozytorium, bo migracje Alembic leżą w db/:
#   docker build -f backend/Dockerfile -t zdechpies-api .
#   docker run --rm -p 8000:8000 --env-file backend/.env -e RUN_MIGRATIONS=true zdechpies-api

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Certyfikaty CA Amazon RDS: backend weryfikuje TLS do bazy (DATABASE_SSL_CA).
# ADD z adresu URL zapisuje plik z prawami 600 - musi być czytelny dla użytkownika app.
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/global-bundle.pem
RUN chmod 755 /app/certs && chmod 644 /app/certs/global-bundle.pem

FROM python:3.12-slim-bookworm
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_SSL_CA=/app/certs/global-bundle.pem
RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app
WORKDIR /app/backend
COPY --from=build /opt/venv /opt/venv
COPY --from=build /app/certs /app/certs
COPY --chown=app:app --chmod=755 backend/entrypoint.sh /app/entrypoint.sh
COPY --chown=app:app backend/app ./app
COPY --chown=app:app db/alembic.ini /app/db/alembic.ini
COPY --chown=app:app db/alembic /app/db/alembic
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"]
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
