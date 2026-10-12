FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app/src

# The key must outlive the container: the agent's name is derived from it, so a
# fresh volume is a different agent, not a fresh start.
ENV CONCIERGE_HOME=/data/concierge

COPY pyproject.toml README.md ./
COPY src ./src
# The operator mints this deployment's grant inside the container, against the
# same volume the agent reads: docker compose exec demo python tools/mint_grant.py
COPY tools ./tools
RUN pip install --no-cache-dir . && mkdir -p /data/concierge

EXPOSE 8080
CMD ["python", "-m", "concierge", "serve"]
