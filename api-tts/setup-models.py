#!/usr/bin/env python3
"""Baixa e valida o OmniVoice (k2-fsa) do HuggingFace."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
HF_HOME = BASE_DIR / "data" / "tts-models"
HF_HOME.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HF_HOME", str(HF_HOME))


def main() -> int:
    print("==> Baixando OmniVoice do HuggingFace (k2-fsa/OmniVoice)...")
    print(f"Destino: {HF_HOME}")
    try:
        import torch

        from omnivoice import OmniVoice
    except ImportError as exc:
        print(f"ERRO: dependência ausente ({exc}). Rode: pip install -r requirements.txt")
        return 1

    try:
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device.startswith("cuda") else torch.float32
        print(f"Dispositivo: {device}")
        OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map=device, dtype=dtype)
        print("OK: modelo OmniVoice pronto.")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERRO: {exc}")
        print(
            "\nSe o HuggingFace pedir login: huggingface-cli login\n"
            "Ou veja https://huggingface.co/k2-fsa/OmniVoice"
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
