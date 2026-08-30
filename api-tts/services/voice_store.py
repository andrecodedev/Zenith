"""CRUD de perfis de voz em disco (gitignored)."""

from __future__ import annotations

import json
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import UploadFile


META_FILE = "meta.json"
REF_FILE = "reference.wav"
SAMPLES_DIR = "samples"
CLIPS_DIR = "clips"

# Soft cap: evita upload absurdo; qualidade ≠ quantidade cega.
MAX_VOICE_FILES = 50
# XTTS usa bem ~6–20s por clip; acima disso corta.
MAX_CLIP_SEC = 14
# Poucos clips limpos clonam melhor que dezenas de WhatsApp comprimidos.
MAX_SPEAKER_CLIPS = 6
MIN_SPEAKER_SEC = 3.0


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_data_dir(data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)


def list_voices(data_dir: Path) -> list[dict[str, Any]]:
    ensure_data_dir(data_dir)
    voices: list[dict[str, Any]] = []
    for path in sorted(data_dir.iterdir()):
        meta_path = path / META_FILE
        if path.is_dir() and meta_path.exists():
            try:
                voices.append(_normalize_meta(json.loads(meta_path.read_text(encoding="utf-8"))))
            except (json.JSONDecodeError, OSError):
                continue
    return voices


def get_voice(data_dir: Path, voice_id: str) -> dict[str, Any] | None:
    meta_path = data_dir / voice_id / META_FILE
    if not meta_path.exists():
        return None
    try:
        return _normalize_meta(json.loads(meta_path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError):
        return None


def _normalize_meta(meta: dict[str, Any]) -> dict[str, Any]:
    """Garante campos estáveis para o front (sampleCount, status, preview)."""
    out = dict(meta)
    count = out.get("sampleCount", out.get("clipCount"))
    out["sampleCount"] = count
    out["sampleDurationSec"] = out.get("sampleDurationSec")
    # legado sem status = já confirmado
    # Legado sem status = voz já em uso (confirmada)
    out["status"] = out.get("status") or "confirmed"
    out["previewStatus"] = out.get("previewStatus") or "none"
    out["previewError"] = out.get("previewError")
    out["hasPreview"] = bool(out.get("hasPreview"))
    out["previewProgressCurrent"] = int(out.get("previewProgressCurrent") or 0)
    out["previewProgressTotal"] = int(out.get("previewProgressTotal") or 0)
    return out


def get_reference_wav(data_dir: Path, voice_id: str) -> Path | None:
    """Compat: um WAV único (legado). Prefira get_speaker_wavs."""
    ref = data_dir / voice_id / REF_FILE
    return ref if ref.exists() else None


def get_speaker_wavs(data_dir: Path, voice_id: str) -> list[Path]:
    """
    Melhores clips curtos para o XTTS (não todos os uploads).

    Analogia: o diretor escolhe 4–6 takes limpos, não joga 18 áudios
    comprimidos do WhatsApp no mesmo bolo (isso dilui o timbre).
    """
    voice_dir = data_dir / voice_id
    if not voice_dir.exists():
        return []
    clips = _ensure_clips(voice_dir)
    if not clips:
        ref = voice_dir / REF_FILE
        return [ref] if ref.exists() else []

    scored: list[tuple[float, Path]] = []
    for clip in clips:
        dur = _probe_duration(clip) or 0.0
        if dur < MIN_SPEAKER_SEC:
            continue
        # Preferência: 5–12s (embaixo = pouco contexto; em cima = ruído/diluição)
        if dur <= 12:
            score = dur
        else:
            score = 12.0 - (dur - 12.0) * 0.4
        scored.append((score, clip))

    scored.sort(key=lambda x: x[0], reverse=True)
    selected = [p for _, p in scored[:MAX_SPEAKER_CLIPS]]
    if selected:
        return selected
    # Fallback: primeiros clips se todos forem curtos demais
    return clips[: min(MAX_SPEAKER_CLIPS, len(clips))]


async def create_voice(
    data_dir: Path,
    name: str,
    files: list[UploadFile],
) -> dict[str, Any]:
    """
    Salva amostras, gera clips curtos por arquivo e um reference.wav
    (preview/meta). Na síntese usamos a lista de clips.
    """
    ensure_data_dir(data_dir)
    if len(files) > MAX_VOICE_FILES:
        raise ValueError(f"Máximo de {MAX_VOICE_FILES} arquivos por voz")

    voice_id = uuid.uuid4().hex[:12]
    voice_dir = data_dir / voice_id
    samples_dir = voice_dir / SAMPLES_DIR
    samples_dir.mkdir(parents=True, exist_ok=True)

    saved: list[Path] = []
    try:
        for idx, upload in enumerate(files):
            raw_name = upload.filename or f"sample_{idx}.wav"
            suffix = Path(raw_name).suffix.lower() or ".wav"
            if suffix not in {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".opus", ".aac"}:
                suffix = ".wav"
            dest = samples_dir / f"sample_{idx:02d}{suffix}"
            content = await upload.read()
            if not content:
                continue
            dest.write_bytes(content)
            saved.append(dest)

        if not saved:
            shutil.rmtree(voice_dir, ignore_errors=True)
            raise ValueError("Nenhum arquivo de áudio válido enviado")

        clips = _ensure_clips(voice_dir, force=True)
        ref_path = voice_dir / REF_FILE
        _build_reference_from_clips(clips, ref_path)

        meta = {
            "id": voice_id,
            "name": name.strip() or "Sem nome",
            "createdAt": _utc_now(),
            "sampleCount": len(saved),
            "clipCount": len(clips),
            "sampleDurationSec": _probe_duration(ref_path),
            # pending até o usuário ouvir o preview e confirmar (fluxo tipo Fish)
            "status": "pending",
            "previewStatus": "queued",
            "previewError": None,
            "previewProgressCurrent": 0,
            "previewProgressTotal": 0,
        }
        (voice_dir / META_FILE).write_text(
            json.dumps(meta, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return meta
    except Exception:
        shutil.rmtree(voice_dir, ignore_errors=True)
        raise


def delete_voice(data_dir: Path, voice_id: str) -> bool:
    voice_dir = data_dir / voice_id
    if not voice_dir.exists():
        return False
    shutil.rmtree(voice_dir, ignore_errors=True)
    return True


def _ensure_clips(voice_dir: Path, force: bool = False) -> list[Path]:
    clips_dir = voice_dir / CLIPS_DIR
    marker = clips_dir / ".norm_v2"
    if not force and clips_dir.exists() and marker.exists():
        existing = sorted(clips_dir.glob("clip_*.wav"))
        if existing:
            return existing

    samples_dir = voice_dir / SAMPLES_DIR
    if not samples_dir.exists():
        return []

    samples = sorted(
        p
        for p in samples_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {
            ".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".opus", ".aac",
        }
    )
    if not samples:
        return []

    if clips_dir.exists():
        shutil.rmtree(clips_dir, ignore_errors=True)
    clips_dir.mkdir(parents=True, exist_ok=True)

    clips: list[Path] = []
    for i, sample in enumerate(samples):
        out = clips_dir / f"clip_{i:02d}.wav"
        _normalize_clip(sample, out, max_sec=MAX_CLIP_SEC)
        if out.exists() and out.stat().st_size > 1000:
            clips.append(out)
    (clips_dir / ".norm_v2").write_text("1", encoding="utf-8")
    return clips


def _normalize_clip(src: Path, dest: Path, max_sec: int = MAX_CLIP_SEC) -> None:
    """
    Mono 24 kHz PCM, silêncio cortado, loudness alinhado, no máximo max_sec.
    WhatsApp/MP3 comprimido ainda limita o teto de qualidade do XTTS.
    """
    # silenceremove nas pontas + loudnorm (timbre mais estável entre clips)
    af = (
        "silenceremove=start_periods=1:start_silence=0.2:start_threshold=-40dB,"
        "areverse,silenceremove=start_periods=1:start_silence=0.2:start_threshold=-40dB,areverse,"
        "loudnorm=I=-16:TP=-1.5:LRA=11"
    )
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(src),
            "-af", af,
            "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le",
            "-t", str(max_sec),
            str(dest),
        ],
        check=True,
        capture_output=True,
    )


def _build_reference_from_clips(clips: list[Path], out_path: Path) -> None:
    """Concat só para meta/duração; síntese usa a lista de clips."""
    if not clips:
        raise ValueError("Sem clips para referência")
    if len(clips) == 1:
        shutil.copyfile(clips[0], out_path)
        return

    list_file = out_path.parent / "concat_list.txt"
    list_file.write_text(
        "".join(f"file '{p.resolve()}'\n" for p in clips),
        encoding="utf-8",
    )
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", str(list_file),
                "-c", "copy",
                str(out_path),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        list_file.unlink(missing_ok=True)


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
        return round(float(result.stdout.strip()), 2)
    except (subprocess.CalledProcessError, ValueError, OSError):
        return None


PREVIEW_FILE = "preview.wav"
PREVIEW_PHRASE = (
    "Olá eu sou o André. Este é um teste rápido do clone de voz no Zenith. "
    "Se esta fala parecer comigo podemos manter o perfil."
)


def get_preview_wav(data_dir: Path, voice_id: str) -> Path | None:
    path = data_dir / voice_id / PREVIEW_FILE
    return path if path.exists() else None


def update_voice_meta(data_dir: Path, voice_id: str, **fields: Any) -> dict[str, Any] | None:
    meta = get_voice(data_dir, voice_id)
    if not meta:
        return None
    meta.update(fields)
    meta_path = data_dir / voice_id / META_FILE
    # get_voice já normaliza; relemos bruto para não perder campos
    raw = json.loads((data_dir / voice_id / META_FILE).read_text(encoding="utf-8"))
    raw.update(fields)
    meta_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    return _normalize_meta(raw)


def confirm_voice(data_dir: Path, voice_id: str) -> dict[str, Any] | None:
    return update_voice_meta(data_dir, voice_id, status="confirmed")


def set_preview_status(
    data_dir: Path,
    voice_id: str,
    preview_status: str,
    preview_error: str | None = None,
    progress_current: int | None = None,
    progress_total: int | None = None,
) -> dict[str, Any] | None:
    fields: dict[str, Any] = {
        "previewStatus": preview_status,
        "previewError": preview_error,
        "hasPreview": preview_status == "ready",
    }
    if progress_current is not None:
        fields["previewProgressCurrent"] = progress_current
    if progress_total is not None:
        fields["previewProgressTotal"] = progress_total
    if preview_status in ("queued", "error"):
        fields.setdefault("previewProgressCurrent", 0)
    if preview_status == "ready" and progress_current is None:
        # Garante 100% no meta quando termina
        meta = get_voice(data_dir, voice_id)
        total = int((meta or {}).get("previewProgressTotal") or 0)
        if total > 0:
            fields["previewProgressCurrent"] = total
    return update_voice_meta(data_dir, voice_id, **fields)
