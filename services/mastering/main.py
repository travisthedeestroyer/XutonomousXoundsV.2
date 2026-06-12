"""Xounds Studio — reference mastering sidecar.

Wraps Matchering 2.0: POST /master with a target mix and a reference
track -> poll /status -> GET /download the mastered WAV.
"""

from pathlib import Path
import shutil
import uuid

import matchering as mg
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="Xounds Mastering")

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

RESULT_NAME = "mastered.wav"


class JobResponse(BaseModel):
    job_id: str
    status: str


def run_mastering(job_id: str, target_path: Path, reference_path: Path) -> None:
    output_path = OUTPUT_DIR / job_id
    output_path.mkdir(exist_ok=True)
    try:
        mg.process(
            target=str(target_path),
            reference=str(reference_path),
            results=[mg.pcm16(str(output_path / RESULT_NAME))],
        )
        (output_path / "done.txt").touch()
    except Exception as exc:  # matchering raises plain Exceptions
        (output_path / "error.txt").write_text(str(exc))
    finally:
        shutil.rmtree(target_path.parent, ignore_errors=True)


@app.post("/master", response_model=JobResponse)
async def master_audio(
    background_tasks: BackgroundTasks,
    target: UploadFile = File(...),
    reference: UploadFile = File(...),
):
    if not target.filename or not reference.filename:
        raise HTTPException(status_code=400, detail="Missing target or reference file")

    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(exist_ok=True)

    target_path = job_dir / f"target_{Path(target.filename).name}"
    reference_path = job_dir / f"reference_{Path(reference.filename).name}"
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(target.file, buffer)
    with open(reference_path, "wb") as buffer:
        shutil.copyfileobj(reference.file, buffer)

    background_tasks.add_task(run_mastering, job_id, target_path, reference_path)
    return {"job_id": job_id, "status": "processing"}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    output_path = OUTPUT_DIR / job_id
    if (output_path / "error.txt").exists():
        return {"job_id": job_id, "status": "error"}
    if (output_path / "done.txt").exists():
        return {"job_id": job_id, "status": "completed", "result": RESULT_NAME}
    return {"job_id": job_id, "status": "processing"}


@app.get("/download/{job_id}/{filename}")
async def download_result(job_id: str, filename: str):
    file_path = OUTPUT_DIR / job_id / Path(filename).name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
