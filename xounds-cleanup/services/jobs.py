"""Small, bounded local job store shared by the optional audio services."""
from pathlib import Path
from uuid import UUID, uuid4
from threading import Lock
import json
import os
import shutil
import time
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse

MAX_BYTES = 100 * 1024 * 1024
AUDIO_SUFFIXES = {'.wav', '.flac', '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.aif', '.aiff', '.webm'}

class JobStore:
    def __init__(self, directory: Path):
        self.root = Path(os.environ.get('AUDIO_DATA_DIR', str(directory))).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.guard = Lock()
        self.worker = Lock()
        self.active = set()
        # Interrupted jobs must fail after a restart instead of polling forever.
        for folder in self.root.iterdir():
            if folder.is_dir() and (folder / 'status.json').is_file():
                try:
                    if json.loads((folder / 'status.json').read_text())['status'] in {'queued', 'processing'}:
                        self.write(folder, {'status': 'error', 'error': 'Service restarted. Please submit the audio again.'})
                except (ValueError, KeyError):
                    pass

    def write(self, directory: Path, status: dict):
        temporary = directory / 'status.tmp'
        temporary.write_text(json.dumps(status))
        temporary.replace(directory / 'status.json')

    def create(self):
        with self.guard:
            now = time.time()
            for folder in self.root.iterdir():
                if folder.is_dir() and folder.name not in self.active and now - folder.stat().st_mtime > 86400:
                    shutil.rmtree(folder, ignore_errors=True)
            if len(self.active) >= 4:
                raise HTTPException(503, 'Audio service is busy. Try again after a job finishes.')
            job_id = str(uuid4())
            folder = self.root / job_id
            (folder / 'input').mkdir(parents=True)
            (folder / 'output').mkdir()
            self.active.add(job_id)
            self.write(folder, {'status': 'queued'})
            return job_id, folder

    def folder(self, job_id: UUID):
        folder = self.root / str(job_id)
        if not (folder / 'status.json').is_file():
            raise HTTPException(404, 'Job not found or expired.')
        return folder

    async def save_upload(self, file: UploadFile, directory: Path, prefix: str):
        suffix = Path(file.filename or '').suffix.lower()
        if suffix not in AUDIO_SUFFIXES:
            raise HTTPException(400, 'Choose a supported audio file.')
        target = directory / 'input' / f'{prefix}{suffix}'
        total = 0
        try:
            with target.open('wb') as output:
                while chunk := await file.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise HTTPException(413, 'Audio files must be smaller than 100 MB.')
                    output.write(chunk)
            if not total:
                raise HTTPException(400, 'The audio file is empty.')
            return target
        finally:
            await file.close()

    def discard(self, job_id: str, directory: Path):
        with self.guard:
            self.active.discard(job_id)
        shutil.rmtree(directory, ignore_errors=True)

    def run(self, job_id: str, folder: Path, action, result_kind: str):
        try:
            with self.worker:
                self.write(folder, {'status': 'processing'})
                action(folder / 'output')
                results = sorted(p.name for p in (folder / 'output').iterdir() if p.suffix.lower() in {'.wav', '.flac', '.mp3'} and p.is_file() and p.stat().st_size > 44)
                if not results:
                    raise RuntimeError('The audio processor produced no playable output.')
                self.write(folder, {'status': 'completed', **({'stems': results} if result_kind == 'stems' else {'result': results[0]})})
        except Exception as error:
            # Detailed diagnostics stay in the service log, never downloadable.
            print(f'Audio job {job_id} failed: {error}', flush=True)
            self.write(folder, {'status': 'error', 'error': 'Audio processing failed. Check the service log and verify the input audio.'})
        finally:
            shutil.rmtree(folder / 'input', ignore_errors=True)
            with self.guard:
                self.active.discard(job_id)

    def status(self, job_id: UUID):
        return {'job_id': str(job_id), **json.loads((self.folder(job_id) / 'status.json').read_text())}

    def download(self, job_id: UUID, filename: str):
        folder = self.folder(job_id)
        status = self.status(job_id)
        allowed = status.get('stems', []) if 'stems' in status else [status.get('result')]
        if status['status'] != 'completed' or filename not in allowed or Path(filename).name != filename:
            raise HTTPException(404, 'Audio result not found.')
        result = folder / 'output' / filename
        if not result.is_file() or result.is_symlink():
            raise HTTPException(404, 'Audio result not found.')
        return FileResponse(result, filename=filename)
