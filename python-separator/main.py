from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil
import os
import uuid
import subprocess
from pathlib import Path

app = FastAPI(title="Audio Separator API")

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

class SeparationResponse(BaseModel):
    job_id: str
    status: str

@app.post("/separate", response_model=SeparationResponse)
async def separate_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    
    input_path = job_dir / file.filename
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Run separation in background
    background_tasks.add_task(run_separation, job_id, input_path)
    
    return {"job_id": job_id, "status": "processing"}

def run_separation(job_id: str, input_path: Path):
    output_path = OUTPUT_DIR / job_id
    output_path.mkdir(exist_ok=True)
    
    try:
        # Example using audio-separator CLI
        # audio-separator input.wav --model_filename UVR-MDX-NET-Inst_HQ_3.onnx --output_dir outputs/job_id
        subprocess.run([
            "audio-separator", 
            str(input_path), 
            "--model_filename", "UVR-MDX-NET-Inst_HQ_3.onnx", 
            "--output_dir", str(output_path)
        ], check=True)
        
        # Mark as done (in a real app, use a database or Redis)
        (output_path / "done.txt").touch()
    except subprocess.CalledProcessError as e:
        print(f"Separation failed for {job_id}: {e}")
        (output_path / "error.txt").write_text(str(e))

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    output_path = OUTPUT_DIR / job_id
    if (output_path / "error.txt").exists():
        return {"job_id": job_id, "status": "error"}
    if (output_path / "done.txt").exists():
        # List generated stems
        stems = [f.name for f in output_path.iterdir() if f.suffix in ['.wav', '.flac', '.mp3']]
        return {"job_id": job_id, "status": "completed", "stems": stems}
    
    return {"job_id": job_id, "status": "processing"}

@app.get("/download/{job_id}/{filename}")
async def download_stem(job_id: str, filename: str):
    file_path = OUTPUT_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
