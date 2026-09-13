# Zenith Voice Studio API (`api-tts`)

API Python (FastAPI) para clone de voz + TTS com **OmniVoice (k2-fsa)**.
Uso **local** (CPU no VAIO FE16, sem GPU CUDA/MPS). Porta padrão: **3334**.

## Limite neste PC
- **1500 caracteres** por geração (~2–4 parágrafos)
- Chunking automático + concat com `ffmpeg`
- 1 job por vez
- Referência de voz: 1 clipe de 3–10s (o motor recorta se vier maior)

## Setup (primeira vez)

```bash
cd ~/Documentos/projetos-pessoais/zenith/api-tts
python3 -m venv .venv
source .venv/bin/activate

# Torch CPU (recomendado sem GPU dedicada)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# omnivoice sem deps primeiro (evita puxar o gradio, que não usamos e trava
# a resolução com fastapi/pydantic pinados)
pip install --no-deps omnivoice==0.2.1
pip install -r requirements.txt
python setup-models.py   # baixa OmniVoice (demora / usa disco)
```

Se a partição raiz (`/`) estiver quase cheia, aponte o `TMPDIR` do pip pra
`/home` antes de instalar (o pip baixa pacotes em `/tmp` antes de mover pro
cache, e isso pode estourar espaço numa raiz pequena):

```bash
mkdir -p ~/tmp-pip
export TMPDIR=~/tmp-pip
```

## Rodar

```bash
cd ~/Documentos/projetos-pessoais/zenith/api-tts
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 3334
```

Frontend (`.env.local`):
```
VITE_TTS_API_URL=http://127.0.0.1:3334
```

Depois: `npm run dev` → IA → Voice Studio.

## Endpoints
- `GET /health`
- `GET /voices` · `POST /voices/create` · `DELETE /voices/{id}`
- `POST /tts/generate` · `GET /tts/status/{jobId}` · `GET /tts/download/{jobId}`
