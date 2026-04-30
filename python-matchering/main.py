from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil
import os
import uuid
import matchering as mg
from pathlib import Path

app = FastAPI(title="Matchering API")

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

class MasteringResponse(BaseModel):
    job_id: str
    status: str

@app.post("/master", response_model=MasteringResponse)
async def master_audio(
    background_tasks: BackgroundTasks, 
    target: UploadFile = File(...),
    reference: UploadFile = File(...)
):
    if not target.filename or not reference.filename:
        raise HTTPException(status_code=400, detail="Missing target or reference file")
    
    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    
    target_path = job_dir / f"target_{target.filename}"
    reference_path = job_dir / f"reference_{reference.filename}"
    
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(target.file, buffer)
        
    with open(reference_path, "wb") as buffer:
        shutil.copyfileobj(reference.file, buffer)
        
    # Run mastering in background
    background_tasks.add_task(run_mastering, job_id, target_path, reference_path)
    
    return {"job_id": job_id, "status": "processing"}

def run_mastering(job_id: str, target_path: Path, reference_path: Path):
    output_path = OUTPUT_DIR / job_id
    output_path.mkdir(exist_ok=True)
    
    result_path = output_path / "mastered.wav"
    
    try:
        # Run matchering
        mg.process(
            target=str(target_path),
            reference=str(reference_path),
            results=[
                mg.pcm16(str(result_path))
            ]
        )
        
        # Mark as done
        (output_path / "done.txt").touch()
    except Exception as e:
        print(f"Mastering failed for {job_id}: {e}")
        (output_path / "error.txt").write_text(str(e))

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    output_path = OUTPUT_DIR / job_id
    if (output_path / "error.txt").exists():
        return {"job_id": job_id, "status": "error"}
    if (output_path / "done.txt").exists():
        return {"job_id": job_id, "status": "completed", "result": "mastered.wav"}
    
    return {"job_id": job_id, "status": "processing"}

@app.get("/download/{job_id}/{filename}")
async def download_result(job_id: str, filename: str):
    file_path = OUTPUT_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
