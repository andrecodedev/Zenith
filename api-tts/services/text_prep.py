"""Prepara texto em PT para o XTTS (evita falar nome da pontuação)."""

from __future__ import annotations

import re
import unicodedata


# XTTS v2 em português costuma verbalizar ".", ",", "?", "!" como
# "ponto", "vírgula", "interrogação", "exclamação" (bug conhecido do modelo).
# Comunidade: "|" vira pausa sem falar o nome do sinal.
_SENTENCE_END = re.compile(r"[.!?…]+")
_COMMA_LIKE = re.compile(r"[,;:]+")
# Mantém letras (incl. acentos), dígitos, espaço e pipe de pausa
_KEEP = re.compile(r"[^\w\s|]", re.UNICODE)


def prepare_tts_text(text: str) -> str:
    """
    Teleprompter limpo: só a fala. Pontuação vira pausa (|), nunca palavra.

    Ex.: 'Olá, eu sou o André.' -> 'Olá eu sou o André |'
    """
    if not text:
        return ""

    t = unicodedata.normalize("NFKC", text)

    # Aspas / tipografia
    for ch in ('"', "'", "`", "«", "»", "“", "”", "‘", "’", "‚", "‛"):
        t = t.replace(ch, "")

    # Símbolos que viram palavra ou ruído
    t = t.replace("&", " e ")
    t = t.replace("%", " por cento ")
    t = t.replace("/", " ")
    t = t.replace("\\", " ")
    t = t.replace("|", " ")  # limpa pipes do usuário; recolocamos só como pausa
    t = t.replace("*", " ")
    t = t.replace("_", " ")
    t = t.replace("#", " ")
    t = t.replace("@", " ")
    t = t.replace("–", " ")
    t = t.replace("—", " ")
    t = t.replace("−", " ")
    t = t.replace("•", " ")
    t = t.replace("·", " ")
    t = t.replace("...", " ")
    t = t.replace("…", " ")

    for ch in "()[]{}<>":
        t = t.replace(ch, " ")

    # Vírgula / ponto-e-vírgula / dois-pontos: NÃO deixar no texto (vira "vírgula")
    t = _COMMA_LIKE.sub(" ", t)

    # Fim de frase: pausa com | (não falar "ponto" / "exclamação")
    t = _SENTENCE_END.sub(" | ", t)

    # Qualquer outro símbolo sobrando
    t = _KEEP.sub(" ", t)

    # Colapsa espaços e pipes duplicados
    t = re.sub(r"\s*\|\s*", " | ", t)
    t = re.sub(r"(?:\s*\|\s*){2,}", " | ", t)
    t = re.sub(r"\s{2,}", " ", t)
    t = t.strip(" |")

    return t.strip()
