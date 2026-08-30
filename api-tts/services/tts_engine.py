"""Motor TTS: Coqui XTTS v2 em CPU (fallback sem NVIDIA)."""

from __future__ import annotations

import logging
import subprocess
import threading
from pathlib import Path
from typing import Callable

logger = logging.getLogger("zenith-tts")

_tts = None
_tts_lock = threading.Lock()
_load_error: str | None = None
_torchaudio_patched = False


def _patch_torchaudio_load() -> None:
    """
    torchaudio 2.9+ redireciona load() para torchcodec.
    No Zenith (CPU, sem torchcodec) lemos com soundfile; MP3 etc. via ffmpeg.
    """
    global _torchaudio_patched
    if _torchaudio_patched:
        return

    import tempfile

    import numpy as np
    import soundfile as sf
    import torch
    import torchaudio

    def load(  # noqa: ANN001
        uri,
        frame_offset: int = 0,
        num_frames: int = -1,
        normalize: bool = True,
        channels_first: bool = True,
        format=None,
        buffer_size: int = 4096,
        backend=None,
    ):
        del normalize, format, buffer_size, backend  # API compat
        path = str(uri)

        def _from_array(data: np.ndarray, sr: int):
            if data.ndim == 1:
                data = data[np.newaxis, :]
            else:
                data = data.T
            waveform = torch.from_numpy(np.ascontiguousarray(data, dtype=np.float32))
            if frame_offset:
                waveform = waveform[:, frame_offset:]
            if num_frames is not None and num_frames > 0:
                waveform = waveform[:, :num_frames]
            if not channels_first:
                waveform = waveform.transpose(0, 1)
            return waveform, int(sr)

        try:
            data, sr = sf.read(path, dtype="float32", always_2d=True)
            return _from_array(data, sr)
        except Exception:
            fd, tmp_name = tempfile.mkstemp(suffix=".wav")
            import os as _os

            _os.close(fd)
            try:
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", path,
                        "-ac", "1", "-ar", "24000",
                        tmp_name,
                    ],
                    check=True,
                    capture_output=True,
                )
                data, sr = sf.read(tmp_name, dtype="float32", always_2d=True)
                return _from_array(data, sr)
            finally:
                Path(tmp_name).unlink(missing_ok=True)

    torchaudio.load = load  # type: ignore[assignment]
    _torchaudio_patched = True
    logger.info("torchaudio.load patchado (soundfile/ffmpeg, sem torchcodec)")


def cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def engine_status() -> dict:
    """Estado do motor para /health."""
    global _tts, _load_error
    return {
        "engine": "xtts_v2",
        "loaded": _tts is not None,
        "cuda": cuda_available(),
        "device": "cuda" if cuda_available() else "cpu",
        "loadError": _load_error,
    }


def load_engine() -> None:
    """Carrega o modelo na primeira necessidade (lazy)."""
    global _tts, _load_error
    if _tts is not None:
        return
    with _tts_lock:
        if _tts is not None:
            return
        try:
            import os
            from pathlib import Path

            # Modelos no projeto (não em ~/.local/share/tts)
            base = Path(__file__).resolve().parents[1]
            tts_home = base / "data" / "tts-models"
            tts_home.mkdir(parents=True, exist_ok=True)
            os.environ.setdefault("TTS_HOME", str(tts_home))
            os.environ.setdefault("COQUI_TOS_AGREED", "1")
            mpl = base / "data" / "mpl-cache"
            mpl.mkdir(parents=True, exist_ok=True)
            os.environ.setdefault("MPLCONFIGDIR", str(mpl))

            # PyTorch >= 2.6: torch.load default weights_only=True quebra o checkpoint XTTS.
            import torch

            _torch_load = torch.load

            def _torch_load_compat(*args, **kwargs):
                kwargs.setdefault("weights_only", False)
                return _torch_load(*args, **kwargs)

            torch.load = _torch_load_compat  # type: ignore[method-assign]

            # torchaudio >= 2.9 exige torchcodec; no CPU local usamos soundfile/ffmpeg.
            _patch_torchaudio_load()

            from TTS.api import TTS

            device = "cuda" if cuda_available() else "cpu"
            logger.info("Carregando XTTS v2 em %s (pode demorar na 1ª vez)...", device)
            _tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            # Clone: usar mais áudio de referência + amostragem um pouco mais natural.
            # (API Coqui sobrescreve kwargs com estes valores do config.)
            try:
                cfg = _tts.synthesizer.tts_config
                cfg.gpt_cond_len = 30
                cfg.gpt_cond_chunk_len = 6
                cfg.max_ref_len = 30
                cfg.temperature = 0.6
                cfg.repetition_penalty = 5.0
            except Exception:  # noqa: BLE001
                logger.warning("Não foi possível ajustar config XTTS; usando defaults")
            _load_error = None
            logger.info("XTTS v2 pronto.")
        except Exception as exc:  # noqa: BLE001
            _load_error = str(exc)
            logger.exception("Falha ao carregar XTTS")
            raise RuntimeError(
                "Motor XTTS indisponível. No api-tts: "
                "pip install TTS==0.22.0 && python setup-models.py "
                "(depois reinicie o uvicorn)"
            ) from exc


def synthesize_chunk(
    text: str,
    speaker_wav: Path | list[Path],
    out_wav: Path,
    language: str = "pt",
    speed: float = 1.0,
    temperature: float | None = None,
) -> None:
    from services.text_prep import prepare_tts_text

    load_engine()
    assert _tts is not None
    out_wav.parent.mkdir(parents=True, exist_ok=True)

    text = prepare_tts_text(text)
    # Segurança: nunca enviar "|" / pontuação residual ao modelo
    text = text.replace("|", " ").strip()
    text = " ".join(text.split())
    if not text:
        raise ValueError("Chunk de texto vazio após limpeza de pontuação")

    # Lista de clips: XTTS média embeddings (bem melhor que 1 WAV de 90s).
    if isinstance(speaker_wav, list):
        speaker_arg: str | list[str] = [str(p) for p in speaker_wav]
    else:
        speaker_arg = str(speaker_wav)

    prev_temp = None
    if temperature is not None:
        try:
            cfg = _tts.synthesizer.tts_config
            prev_temp = getattr(cfg, "temperature", None)
            cfg.temperature = float(temperature)
        except Exception:  # noqa: BLE001
            logger.warning("Não foi possível ajustar temperature=%.2f", temperature)

    kwargs = {
        "text": text,
        "file_path": str(out_wav),
        "speaker_wav": speaker_arg,
        "language": language if language in {"pt", "en", "es", "fr", "de", "it"} else "pt",
        # Já fatiamos no chunker; split interno do Coqui recoloca pontuação e fala "ponto"
        "split_sentences": False,
    }
    try:
        # Coqui API: tts_to_file
        try:
            _tts.tts_to_file(**kwargs, speed=speed)
        except TypeError:
            kwargs.pop("split_sentences", None)
            try:
                _tts.tts_to_file(**kwargs, speed=speed)
            except TypeError:
                _tts.tts_to_file(**kwargs)
    finally:
        if prev_temp is not None:
            try:
                _tts.synthesizer.tts_config.temperature = prev_temp
            except Exception:  # noqa: BLE001
                pass


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
