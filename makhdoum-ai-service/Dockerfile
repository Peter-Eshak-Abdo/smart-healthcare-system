# Kept strictly for Hugging Face Spaces Docker deployment (Free Tier).
# Local development runs natively without Docker using: `python -m uv run uvicorn app.main:app --port 8000`
FROM python:3.13-slim

WORKDIR /app
RUN useradd -m -u 1000 user

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --chown=user pyproject.toml red-flags.yaml ./
RUN uv sync --no-dev --no-install-project

COPY --chown=user app ./app
USER user

ENV PORT=7860
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"7860\")}/internal/v1/health')"

CMD ["sh", "-c", "uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
