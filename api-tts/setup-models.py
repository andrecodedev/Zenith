#!/usr/bin/env python3
"""Baixa XTTS v2 direto do HuggingFace (bypass do gateway Scarf/Coqui que costuma falhar)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
TTS_HOME = BASE_DIR / "data" / "tts-models"
MODEL_DIR = TTS_HOME / "tts" / "tts_models--multilingual--multi-dataset--xtts_v2"
MPL = BASE_DIR / "data" / "mpl-cache"

TTS_HOME.mkdir(parents=True, exist_ok=True)
MPL.mkdir(parents=True, exist_ok=True)
os.environ["TTS_HOME"] = str(TTS_HOME)
os.environ["COQUI_TOS_AGREED"] = "1"
os.environ["MPLCONFIGDIR"] = str(MPL)


def main() -> int:
    print("==> Baixando XTTS v2 do HuggingFace (coqui/XTTS-v2)...")
    print(f"Destino: {MODEL_DIR}")
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("ERRO: huggingface_hub ausente. Rode: pip install huggingface_hub")
        return 1

    try:
        snapshot_download(
            repo_id="coqui/XTTS-v2",
            local_dir=str(MODEL_DIR),
            local_dir_use_symlinks=False,
        )
        # Coqui marca modelo pronto com este arquivo em alguns fluxos
        done = MODEL_DIR / "done"
        if not done.exists():
            done.write_text("ok\n", encoding="utf-8")

        print("==> Validando carga local...")
        import torch

        _torch_load = torch.load

        def _torch_load_compat(*args, **kwargs):
            kwargs.setdefault("weights_only", False)
            return _torch_load(*args, **kwargs)

        torch.load = _torch_load_compat  # type: ignore[method-assign]

        from TTS.api import TTS

        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Dispositivo: {device}")
        TTS("tts_models/multilingual/multi-dataset/xtts_v2")
        print("OK: modelo XTTS v2 pronto.")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERRO: {exc}")
        print(
            "\nSe o HuggingFace pedir login: huggingface-cli login\n"
            "Ou baixe manualmente em https://huggingface.co/coqui/XTTS-v2"
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
