FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base r-base-dev build-essential libcurl4-openssl-dev libssl-dev libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend

RUN Rscript /app/backend/install_R_packages.R

EXPOSE 8765
WORKDIR /app/backend
CMD ["gunicorn","--workers","2","--threads","4","--timeout","360","--bind","0.0.0.0:8765","api:app"]
