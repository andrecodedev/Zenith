"""
Zenith Voice Studio API — FastAPI local (porta 3334).
Clone de voz + TTS com XTTS v2 (CPU ok, lento sem NVIDIA).
"""

from __future__ import annotations

import os
import re
import shutil
import threading
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from services.chunker import split_text_into_chunks
from services.text_prep import prepare_tts_text
from services import tts_engine
from services import voice_store

BASE_DIR = Path(__file__).resolve().parent
_TTS_HOME = BASE_DIR / "data" / "tts-models"
_TTS_HOME.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("TTS_HOME", str(_TTS_HOME))
os.environ.setdefault("COQUI_TOS_AGREED", "1")
_MPL = BASE_DIR / "data" / "mpl-cache"
_MPL.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(_MPL))

DATA_DIR = Path(os.getenv("TTS_DATA_DIR", str(BASE_DIR / "data" / "voices"))).resolve()
JOBS_DIR = (BASE_DIR / "data" / "jobs").resolve()
TMP_DIR = (BASE_DIR / "data" / "tmp").resolve()
MAX_CHARS = int(os.getenv("TTS_MAX_CHARS", "1500"))
CHUNK_CHARS = int(os.getenv("TTS_CHUNK_CHARS", "350"))
PORT = int(os.getenv("TTS_PORT", "3334"))

# Temperaturas das 2 variantes (A mais estável, B mais variada)
VARIANT_TEMPS = (0.55, 0.72)

voice_store.ensure_data_dir(DATA_DIR)
JOBS_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Zenith Voice TTS", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_job_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}
_executor = ThreadPoolExecutor(max_workers=1)
# Epoch por voz: regenerar cancela o resultado do job antigo (CPU ainda termina o atual)
_preview_epoch: dict[str, int] = {}


class GenerateBody(BaseModel):
    voiceId: str
    text: str = Field(..., min_length=1)
    speed: float = Field(1.0, ge=0.8, le=1.2)
    language: Literal["pt", "en", "es", "fr", "de", "it"] = "pt"
    # 2 = estilo Fish: duas takes para escolher
    variants: int = Field(2, ge=1, le=2)


def _split_preview_chunks(phrase: str) -> list[str]:
    """Parte a frase de teste em sentenças = passos da barra de progresso.

    Após prepare_tts_text a pontuação vira "|": splitamos nisso para
    o modelo nunca ver ponto/vírgula (e não falar "ponto").
    """
    parts = [p.strip() for p in re.split(r"\s*\|\s*", phrase) if p.strip()]
    if len(parts) <= 1:
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", phrase) if p.strip()]
    return parts if parts else [phrase]


def _queue_voice_preview(voice_id: str) -> None:
    """Gera frase curta de teste após criar a voz (ouvir antes de confirmar)."""
    epoch = _preview_epoch.get(voice_id, 0) + 1
    _preview_epoch[voice_id] = epoch
    phrase = prepare_tts_text(voice_store.PREVIEW_PHRASE)
    chunks = _split_preview_chunks(phrase)
    voice_store.set_preview_status(
        DATA_DIR,
        voice_id,
        "queued",
        progress_current=0,
        progress_total=len(chunks),
    )

    def run() -> None:
        with _job_lock:
            if _preview_epoch.get(voice_id) != epoch:
                return
            voice_store.set_preview_status(
                DATA_DIR,
                voice_id,
                "running",
                progress_current=0,
                progress_total=len(chunks),
            )
            try:
                speakers = voice_store.get_speaker_wavs(DATA_DIR, voice_id)
                if not speakers:
                    raise RuntimeError("Sem clips de referência para preview")
                out = DATA_DIR / voice_id / voice_store.PREVIEW_FILE
                work = TMP_DIR / f"preview_{voice_id}_{epoch}"

                def on_progress(cur: int, total: int) -> None:
                    if _preview_epoch.get(voice_id) != epoch:
                        return
                    voice_store.update_voice_meta(
                        DATA_DIR,
                        voice_id,
                        previewProgressCurrent=cur,
                        previewProgressTotal=total,
                    )

                tts_engine.generate_speech(
                    text_chunks=chunks,
                    speaker_wav=speakers,
                    work_dir=work,
                    output_path=out,
                    language="pt",
                    speed=1.0,
                    temperature=0.55,
                    on_progress=on_progress,
                )
                shutil.rmtree(work, ignore_errors=True)
                if _preview_epoch.get(voice_id) != epoch:
                    return
                voice_store.set_preview_status(
                    DATA_DIR,
                    voice_id,
                    "ready",
                    progress_current=len(chunks),
                    progress_total=len(chunks),
                )
            except Exception as exc:  # noqa: BLE001
                traceback.print_exc()
                if _preview_epoch.get(voice_id) != epoch:
                    return
                voice_store.set_preview_status(
                    DATA_DIR, voice_id, "error", preview_error=str(exc)
                )

    _executor.submit(run)


@app.get("/health")
def health() -> dict[str, Any]:
    status = tts_engine.engine_status()
    return {
        "status": "ok",
        "maxChars": MAX_CHARS,
        "chunkChars": CHUNK_CHARS,
        "voicesDir": str(DATA_DIR),
        "ffmpeg": shutil.which("ffmpeg") is not None,
        **status,
    }


@app.get("/voices")
def list_voices() -> list[dict[str, Any]]:
    return voice_store.list_voices(DATA_DIR)


@app.get("/voices/{voice_id}")
def get_voice(voice_id: str) -> dict[str, Any]:
    voice = voice_store.get_voice(DATA_DIR, voice_id)
    if not voice:
        raise HTTPException(404, "Voz não encontrada")
    return voice


@app.post("/voices/create")
async def create_voice(
    name: str = Form(...),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    if not name.strip():
        raise HTTPException(400, "Nome da voz é obrigatório")
    if not files:
        raise HTTPException(400, "Envie pelo menos 1 arquivo de áudio")
    if len(files) > voice_store.MAX_VOICE_FILES:
        raise HTTPException(
            400,
            f"Máximo de {voice_store.MAX_VOICE_FILES} arquivos por voz "
            "(clips limpos de 6–18s ajudam mais que dezenas de áudios ruins)",
        )

    try:
        meta = await voice_store.create_voice(DATA_DIR, name, files)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(500, f"Falha ao criar voz: {exc}") from exc

    # Preview assíncrono: usuário ouve antes de confirmar (como no Fish)
    _queue_voice_preview(meta["id"])
    return meta


@app.post("/voices/{voice_id}/preview")
def rebuild_preview(voice_id: str) -> dict[str, Any]:
    """Recalcula o áudio de teste do clone."""
    voice = voice_store.get_voice(DATA_DIR, voice_id)
    if not voice:
        raise HTTPException(404, "Voz não encontrada")
    _queue_voice_preview(voice_id)
    return {"ok": True, "previewStatus": "queued"}


@app.get("/voices/{voice_id}/preview")
def download_preview(voice_id: str) -> FileResponse:
    voice = voice_store.get_voice(DATA_DIR, voice_id)
    if not voice:
        raise HTTPException(404, "Voz não encontrada")
    if voice.get("previewStatus") != "ready":
        raise HTTPException(
            409,
            f"Preview ainda não pronto (status={voice.get('previewStatus')})",
        )
    path = voice_store.get_preview_wav(DATA_DIR, voice_id)
    if not path:
        raise HTTPException(404, "Arquivo de preview ausente")
    return FileResponse(
        path,
        media_type="audio/wav",
        filename=f"zenith-preview-{voice_id}.wav",
    )


@app.post("/voices/{voice_id}/confirm")
def confirm_voice(voice_id: str) -> dict[str, Any]:
    """Usuário ouviu o preview e manteve o perfil."""
    meta = voice_store.confirm_voice(DATA_DIR, voice_id)
    if not meta:
        raise HTTPException(404, "Voz não encontrada")
    return meta


@app.delete("/voices/{voice_id}")
def delete_voice(voice_id: str) -> dict[str, bool]:
    ok = voice_store.delete_voice(DATA_DIR, voice_id)
    if not ok:
        raise HTTPException(404, "Voz não encontrada")
    return {"ok": True}


@app.post("/tts/generate")
def start_generate(body: GenerateBody) -> dict[str, Any]:
    raw = body.text.strip()
    if not raw:
        raise HTTPException(400, "Texto vazio")
    if len(raw) > MAX_CHARS:
        raise HTTPException(
            400,
            f"Texto com {len(raw)} caracteres. Limite neste PC (CPU): {MAX_CHARS} "
            f"(~2–4 parágrafos). Gere em blocos e junte depois se precisar.",
        )

    text = prepare_tts_text(raw)
    if not text:
        raise HTTPException(400, "Texto ficou vazio após limpar pontuação")

    voice = voice_store.get_voice(DATA_DIR, body.voiceId)
    if not voice:
        raise HTTPException(404, "Voz não encontrada")
    if voice.get("status") == "pending":
        raise HTTPException(
            400,
            "Esta voz ainda está pendente. Ouça o preview em Minhas Vozes e clique em Manter "
            "(ou Descartar / gerar preview de novo).",
        )

    speaker_wavs = voice_store.get_speaker_wavs(DATA_DIR, body.voiceId)
    if not speaker_wavs:
        raise HTTPException(400, "Amostra de referência ausente nesta voz")

    if not shutil.which("ffmpeg"):
        raise HTTPException(500, "ffmpeg não encontrado no sistema")

    chunks = split_text_into_chunks(text, max_chars=CHUNK_CHARS)
    if not chunks:
        raise HTTPException(400, "Não foi possível fatiar o texto")

    n_variants = 2 if body.variants == 2 else 1
    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    outputs = [job_dir / ("output_a.wav" if i == 0 else "output_b.wav") for i in range(n_variants)]
    # Compat: output.wav = variante A
    primary = job_dir / "output.wav"

    total_steps = len(chunks) * n_variants
    _jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "chunkCurrent": 0,
        "chunkTotal": total_steps,
        "error": None,
        "outputPath": str(primary),
        "variantPaths": [str(p) for p in outputs],
        "variantCount": n_variants,
        "voiceId": body.voiceId,
        "charCount": len(text),
    }

    def run_job() -> None:
        with _job_lock:
            job = _jobs.get(job_id)
            if not job:
                return
            job["status"] = "running"
            try:
                def on_progress(cur: int, total: int) -> None:
                    job["chunkCurrent"] = cur
                    job["chunkTotal"] = total

                for vi, out_path in enumerate(outputs):
                    temp = VARIANT_TEMPS[vi] if n_variants > 1 else None
                    work = TMP_DIR / f"{job_id}_v{vi}"
                    tts_engine.generate_speech(
                        text_chunks=chunks,
                        speaker_wav=speaker_wavs,
                        work_dir=work,
                        output_path=out_path,
                        language=body.language,
                        speed=body.speed,
                        temperature=temp,
                        on_progress=on_progress,
                        progress_offset=vi * len(chunks),
                        progress_total=total_steps,
                    )
                    shutil.rmtree(work, ignore_errors=True)

                # A como download padrão
                shutil.copyfile(outputs[0], primary)
                job["status"] = "done"
                job["chunkCurrent"] = job["chunkTotal"]
            except Exception as exc:  # noqa: BLE001
                traceback.print_exc()
                job["status"] = "error"
                job["error"] = str(exc)

    _executor.submit(run_job)
    return {
        "jobId": job_id,
        "chunkTotal": total_steps,
        "charCount": len(text),
        "maxChars": MAX_CHARS,
        "variantCount": n_variants,
        "device": "cuda" if tts_engine.cuda_available() else "cpu",
    }


@app.get("/tts/status/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job não encontrado")
    return {
        "id": job["id"],
        "status": job["status"],
        "chunkCurrent": job["chunkCurrent"],
        "chunkTotal": job["chunkTotal"],
        "error": job["error"],
        "charCount": job.get("charCount"),
        "variantCount": job.get("variantCount", 1),
    }


@app.get("/tts/download/{job_id}")
def download_job(job_id: str, variant: int = 0) -> FileResponse:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job não encontrado")
    if job["status"] != "done":
        raise HTTPException(409, f"Job ainda não pronto (status={job['status']})")

    paths = job.get("variantPaths") or [job["outputPath"]]
    if variant < 0 or variant >= len(paths):
        raise HTTPException(400, f"Variante inválida (0..{len(paths) - 1})")
    path = Path(paths[variant])
    if not path.exists():
        raise HTTPException(500, "Arquivo de saída sumiu")
    label = "a" if variant == 0 else "b"
    return FileResponse(
        path,
        media_type="audio/wav",
        filename=f"zenith-voice-{job_id}-{label}.wav",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=False)
