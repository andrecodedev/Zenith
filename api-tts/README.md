# Zenith Voice Studio API (`api-tts`)

API Python (FastAPI) para clone de voz + TTS com **Coqui XTTS v2**.
Uso **local** (CPU no VAIO FE16). Porta padrão: **3334**.

## Limite neste PC
- **1500 caracteres** por geração (~2–4 parágrafos)
- Chunking automático + concat com `ffmpeg`
- 1 job por vez

## Setup (primeira vez)

```bash
cd ~/Documentos/projetos-pessoais/zenith/api-tts
python3 -m venv .venv
source .venv/bin/activate

# Torch CPU (recomendado sem NVIDIA)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

pip install -r requirements.txt
python setup-models.py   # baixa XTTS (demora / usa disco)
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
