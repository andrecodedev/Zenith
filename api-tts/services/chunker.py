"""Divide roteiro longo em pedaços seguros para o modelo TTS."""

from __future__ import annotations

import re


def split_text_into_chunks(text: str, max_chars: int = 350) -> list[str]:
    """
    Quebra por parágrafo e frase, respeitando max_chars.
    Analogia: cortar o roteiro em takes de estúdio antes de gravar.

    Importante: o text_prep troca pontuação por "|". Sempre explodimos
    "|" em unidades separadas (assim o modelo nunca vê o símbolo).
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    paragraphs = re.split(r"\n\s*\n", cleaned)
    chunks: list[str] = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # 1) Pausas do text_prep viram sentenças isoladas (sem "|")
        units = [u.strip() for u in re.split(r"\s*\|\s*", para) if u.strip()]
        if not units:
            continue

        for unit in units:
            if len(unit) <= max_chars:
                chunks.append(unit)
                continue

            # 2) Unidade ainda longa: tenta pontuação residual
            sentences = re.split(r"(?<=[.!?…])\s+", unit)
            buf = ""
            for sentence in sentences:
                sentence = sentence.strip(" |")
                if not sentence:
                    continue
                candidate = f"{buf} {sentence}".strip() if buf else sentence
                if len(candidate) <= max_chars:
                    buf = candidate
                    continue
                if buf:
                    chunks.append(buf)
                if len(sentence) <= max_chars:
                    buf = sentence
                else:
                    for i in range(0, len(sentence), max_chars):
                        piece = sentence[i : i + max_chars].strip()
                        if piece:
                            chunks.append(piece)
                    buf = ""
            if buf:
                chunks.append(buf)

    return chunks
