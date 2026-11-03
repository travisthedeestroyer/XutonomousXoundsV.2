FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    AUDIO_DATA_DIR=/tmp/xounds-jobs SEPARATOR_MODEL_DIR=/opt/models
RUN apt-get update && apt-get install -y --no-install-recommends build-essential ffmpeg libsndfile1 libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch torchaudio
COPY services/separator/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt
COPY services /app/services
RUN mkdir -p /opt/models && python -c "from audio_separator.separator import Separator; Separator(model_file_dir='/opt/models').load_model(model_filename='UVR-MDX-NET-Inst_HQ_3.onnx')"
RUN useradd --create-home studio && chown -R studio:studio /app /opt/models
USER studio
CMD ["sh", "-c", "exec uvicorn services.separator.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
