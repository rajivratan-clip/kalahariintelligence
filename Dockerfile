# -----------------------------------------------------------------------------
# Stage 1: Build frontend (Vite + React)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile || yarn install

# Copy full source so Vite resolves all imports
COPY . .

# Same-origin API in production (backend serves both)
ENV VITE_API_BASE_URL=
RUN yarn build

# -----------------------------------------------------------------------------
# Stage 2: Backend + serve frontend
# -----------------------------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY api.py database.py ./
COPY --from=frontend /app/dist ./dist

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
