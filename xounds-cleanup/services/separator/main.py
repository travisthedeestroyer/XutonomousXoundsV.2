"""Run locally: python services/separator/main.py (requires FFmpeg)."""
from pathlib import Path
from uuid import UUID
import os
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import BackgroundTasks, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from services.jobs import JobStore

app = FastAPI(title='Xounds Separator')
app.add_middleware(CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.environ.get('ALLOWED_ORIGINS', 'https://xoundsv4-relaxxx.vercel.app,https://xoundsv4.vercel.app').split(',') if origin.strip()],
    allow_methods=['GET', 'POST'], allow_headers=['Content-Type'], expose_headers=['Content-Disposition'])
jobs = JobStore(Path(__file__).parent / 'data')

@app.get('/health')
def health():
    return {'ok': True}

@app.post('/separate', status_code=202)
async def separate(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id, folder = jobs.create()
    try:
        source = await jobs.save_upload(file, folder, 'audio')
    except Exception:
        jobs.discard(job_id, folder)
        raise
    def process(output):
        subprocess.run(['audio-separator', str(source), '--model_filename', os.environ.get('SEPARATOR_MODEL', 'UVR-MDX-NET-Inst_HQ_3.onnx'), '--model_file_dir', os.environ.get('SEPARATOR_MODEL_DIR', '/tmp/xounds-models'), '--output_dir', str(output), '--output_format', 'WAV'], check=True, timeout=1100)
    background_tasks.add_task(jobs.run, job_id, folder, process, 'stems')
    return {'job_id': job_id, 'status': 'queued'}

@app.get('/api/separate/status/{job_id}')
@app.get('/status/{job_id}')
def status(job_id: UUID):
    return jobs.status(job_id)

@app.get('/api/separate/download/{job_id}/{filename}')
@app.get('/download/{job_id}/{filename}')
def download(job_id: UUID, filename: str):
    return jobs.download(job_id, filename)

@app.post('/api/separate', status_code=202)
async def browser_separate(background_tasks: BackgroundTasks, audio: UploadFile = File(...)):
    result = await separate(background_tasks, audio)
    return {'jobId': result['job_id'], 'status': result['status']}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host=os.environ.get('SIDECAR_HOST', '127.0.0.1'), port=8000)
