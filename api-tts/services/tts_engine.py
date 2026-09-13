"""Motor TTS: OmniVoice (k2-fsa) — clone de voz zero-shot multi-idioma."""

from __future__ import annotations

import logging
import subprocess
import threading
from pathlib import Path
from typing import Callable

logger = logging.getLogger("zenith-tts")

_model = None
_model_lock = threading.Lock()
_load_error: str | None = None

# OmniVoice pede referência curta (3-10s); mais que isso piora o clone
# (inverso do XTTS, que preferia várias amostras longas em média).
REF_MAX_SEC = 10

# CPU sem GPU dedicada: menos passos de difusão = mais rápido, troca um pouco de qualidade.
CPU_NUM_STEP = 16
GPU_NUM_STEP = 32


def cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def _mps_available() -> bool:
    try:
        import torch

        return bool(torch.backends.mps.is_available())
    except Exception:
        return False


def _device() -> str:
    if cuda_available():
        return "cuda:0"
    if _mps_available():
        return "mps"
    return "cpu"


def engine_status() -> dict:
    """Estado do motor para /health."""
    global _model, _load_error
    device = _device()
    return {
        "engine": "omnivoice",
        "loaded": _model is not None,
        "cuda": cuda_available(),
        "device": device.split(":")[0],
        "loadError": _load_error,
    }


def load_engine() -> None:
    """Carrega o modelo na primeira necessidade (lazy)."""
    global _model, _load_error
    if _model is not None:
        return
    with _model_lock:
        if _model is not None:
            return
        try:
            import torch

            from omnivoice import OmniVoice

            device = _device()
            dtype = torch.float16 if device.startswith("cuda") else torch.float32
            logger.info(
                "Carregando OmniVoice em %s (1ª vez baixa o checkpoint do HF)...", device
            )
            _model = OmniVoice.from_pretrained(
                "k2-fsa/OmniVoice", device_map=device, dtype=dtype
            )
            _load_error = None
            logger.info("OmniVoice pronto.")
        except Exception as exc:  # noqa: BLE001
            _load_error = str(exc)
            logger.exception("Falha ao carregar OmniVoice")
            raise RuntimeError(
                "Motor OmniVoice indisponível. No api-tts: "
                "pip install omnivoice (depois reinicie o uvicorn)"
            ) from exc


def _probe_duration(path: Path) -> float | None:
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError, OSError):
        return None


def _pick_reference(speaker_wav: Path | list[Path]) -> Path:
    """OmniVoice clona a partir de 1 clipe só; usa o melhor (já ordenado por voice_store)
    e recorta se passar de REF_MAX_SEC."""
    clip = speaker_wav[0] if isinstance(speaker_wav, list) else speaker_wav
    dur = _probe_duration(clip)
    if dur is None or dur <= REF_MAX_SEC:
        return clip

    trimmed = clip.parent / f"_ref_trim_{clip.stem}.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(clip), "-t", str(REF_MAX_SEC), str(trimmed)],
        check=True,
        capture_output=True,
    )
    return trimmed


def synthesize_chunk(
    text: str,
    speaker_wav: Path | list[Path],
    out_wav: Path,
    language: str = "pt",
    speed: float = 1.0,
    temperature: float | None = None,
) -> None:
    import soundfile as sf

    from services.text_prep import prepare_tts_text

    load_engine()
    assert _model is not None
    out_wav.parent.mkdir(parents=True, exist_ok=True)

    text = prepare_tts_text(text)
    # Segurança: nunca enviar "|" / pontuação residual ao modelo
    text = text.replace("|", " ").strip()
    text = " ".join(text.split())
    if not text:
        raise ValueError("Chunk de texto vazio após limpeza de pontuação")

    ref = _pick_reference(speaker_wav)
    num_step = GPU_NUM_STEP if _device() != "cpu" else CPU_NUM_STEP

    audio = _model.generate(
        text=text,
        language=language,
        ref_audio=str(ref),
        # ref_text omitido: OmniVoice transcreve a referência sozinho via Whisper.
        speed=speed,
        num_step=num_step,
        # class_temperature: 0 = clone estável e determinístico; sobe = mais variação.
        class_temperature=temperature if temperature is not None else 0.0,
    )
    sf.write(str(out_wav), audio[0], 24000)


def concat_wavs(chunk_paths: list[Path], output_path: Path) -> None:
    """Concatena WAVs com ffmpeg concat demuxer."""
    if not chunk_paths:
        raise ValueError("Nenhum chunk de áudio para concatenar")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if len(chunk_paths) == 1:
        output_path.write_bytes(chunk_paths[0].read_bytes())
        return

    list_file = output_path.parent / f"{output_path.stem}_concat.txt"
    list_file.write_text(
        "".join(f"file '{p.resolve()}'\n" for p in chunk_paths),
        encoding="utf-8",
    )
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", str(list_file),
                "-c", "copy",
                str(output_path),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        list_file.unlink(missing_ok=True)


def generate_speech(
    text_chunks: list[str],
    speaker_wav: Path | list[Path],
    work_dir: Path,
    output_path: Path,
    language: str = "pt",
    speed: float = 1.0,
    temperature: float | None = None,
    on_progress: Callable[[int, int], None] | None = None,
    progress_offset: int = 0,
    progress_total: int | None = None,
) -> Path:
    """
    Sintetiza cada chunk e concatena.
    Mutex externo (job queue) garante 1 geração por vez.
    """
    work_dir.mkdir(parents=True, exist_ok=True)
    chunk_files: list[Path] = []
    total = progress_total if progress_total is not None else len(text_chunks)

    try:
        if on_progress:
            on_progress(progress_offset, total)
        for i, chunk in enumerate(text_chunks):
            out = work_dir / f"chunk_{i:04d}.wav"
            synthesize_chunk(
                chunk,
                speaker_wav,
                out,
                language=language,
                speed=speed,
                temperature=temperature,
            )
            chunk_files.append(out)
            if on_progress:
                # Reporta depois de cada frase/chunk (barra sobe de verdade)
                on_progress(progress_offset + i + 1, total)

        concat_wavs(chunk_files, output_path)
        return output_path
    finally:
        for p in chunk_files:
            p.unlink(missing_ok=True)
