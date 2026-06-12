"""Xounds Studio — stem separation sidecar.

Wraps the `audio-separator` CLI (UVR MDX-Net models) behind a tiny
job-queue HTTP API: POST /separate -> poll /status -> GET /download.
"""

from pathlib import Path
import shutil
import subprocess
import uuid

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="Xounds Separator")

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL = "UVR-MDX-NET-Inst_HQ_3.onnx"
AUDIO_SUFFIXES = {".wav", ".flac", ".mp3"}


class JobResponse(BaseModel):
    job_id: str
    status: str


def run_separation(job_id: str, input_path: Path) -> None:
    output_path = OUTPUT_DIR / job_id
    output_path.mkdir(exist_ok=True)
    try:
        subprocess.run(
            [
                "audio-separator",
                str(input_path),
                "--model_filename",
                MODEL,
                "--output_dir",
                str(output_path),
            ],
            check=True,
        )
        (output_path / "done.txt").touch()
    except subprocess.CalledProcessError as exc:
        (output_path / "error.txt").write_text(str(exc))
    finally:
        shutil.rmtree(input_path.parent, ignore_errors=True)


@app.post("/separate", response_model=JobResponse)
async def separate_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    input_path = job_dir / Path(file.filename).name

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    background_tasks.add_task(run_separation, job_id, input_path)
    return {"job_id": job_id, "status": "processing"}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    output_path = OUTPUT_DIR / job_id
    if (output_path / "error.txt").exists():
        return {"job_id": job_id, "status": "error"}
    if (output_path / "done.txt").exists():
        stems = [f.name for f in output_path.iterdir() if f.suffix in AUDIO_SUFFIXES]
        return {"job_id": job_id, "status": "completed", "stems": stems}
    return {"job_id": job_id, "status": "processing"}


@app.get("/download/{job_id}/{filename}")
async def download_stem(job_id: str, filename: str):
    file_path = OUTPUT_DIR / job_id / Path(filename).name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
