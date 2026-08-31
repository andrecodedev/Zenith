#!/usr/bin/env bash

set -u

PROJECT_DIR="/home/usuario/Documentos/projetos-pessoais/zenith"
STATE_DIR="${HOME}/.local/state/zenith"
PROFILE_DIR="${HOME}/.local/share/zenith/browser-profile"
LOG_FILE="${STATE_DIR}/zenith.log"
PID_FILE="${STATE_DIR}/launcher.pid"
SERVICE_PID_FILE="${STATE_DIR}/services.pids"
APP_URL="http://127.0.0.1:5173"

mkdir -p "${STATE_DIR}" "${PROFILE_DIR}"

exec 9>"${STATE_DIR}/launcher.lock"
if ! flock -n 9; then
  zenity --info \
    --title="Zenith já está aberto" \
    --text="O Zenith já está em execução."
  exit 0
fi

if [[ ! -d "${PROJECT_DIR}/node_modules" ]] || ! command -v brave-browser >/dev/null; then
  zenity --error \
    --title="Zenith não está preparado" \
    --text="As dependências do projeto ou o navegador Brave não foram encontrados."
  exit 1
fi

selection="$(
  zenity --list --checklist \
    --title="Iniciar Zenith" \
    --text="Escolha os módulos que serão usados nesta sessão:" \
    --width=620 \
    --height=360 \
    --separator="|" \
    --print-column=2 \
    --hide-column=2 \
    --column="Ativar" \
    --column="ID" \
    --column="Módulo" \
    --column="Uso" \
    TRUE music "Música e imagem" "Downloads e melhoria de imagem" \
    FALSE voice "Voz e TTS" "Clonagem e geração de voz" \
    FALSE video "Vídeo" "Editor, exportação, stock e efeitos"
)" || exit 0

has_module() {
  [[ "|${selection}|" == *"|$1|"* ]]
}

port_is_busy() {
  fuser -s "$1/tcp" 2>/dev/null
}

busy_ports=()
port_is_busy 5173 && busy_ports+=("5173")
has_module music && port_is_busy 3333 && busy_ports+=("3333")
has_module voice && port_is_busy 3334 && busy_ports+=("3334")
has_module video && port_is_busy 3335 && busy_ports+=("3335")

if (( ${#busy_ports[@]} > 0 )); then
  zenity --error \
    --title="Zenith não pôde iniciar" \
    --text="Estas portas já estão em uso: ${busy_ports[*]}\n\nFeche os servidores abertos manualmente e tente novamente."
  exit 1
fi

if has_module voice && [[ ! -x "${PROJECT_DIR}/api-tts/.venv/bin/python" ]]; then
  zenity --error \
    --title="Módulo de voz indisponível" \
    --text="O ambiente Python de api-tts não foi encontrado."
  exit 1
fi

if has_module music && [[ ! -d "${PROJECT_DIR}/api/node_modules" ]]; then
  zenity --error \
    --title="Módulo de música indisponível" \
    --text="As dependências de api não foram encontradas."
  exit 1
fi

if has_module video && [[ ! -d "${PROJECT_DIR}/api-video/node_modules" ]]; then
  zenity --error \
    --title="Módulo de vídeo indisponível" \
    --text="As dependências de api-video não foram encontradas."
  exit 1
fi

: >"${LOG_FILE}"
printf '%s\n' "$$" >"${PID_FILE}"
: >"${SERVICE_PID_FILE}"

service_pids=()
browser_pid=""
cleaned_up=false

start_service() {
  local name="$1"
  local directory="$2"
  shift 2

  printf '\n[%s]\n' "${name}" >>"${LOG_FILE}"
  setsid bash -c 'cd "$1" && shift && exec "$@"' _ "${directory}" "$@" >>"${LOG_FILE}" 2>&1 &
  local service_pid=$!
  service_pids+=("${service_pid}")
  printf '%s\n' "${service_pid}" >>"${SERVICE_PID_FILE}"
}

cleanup() {
  if [[ "${cleaned_up}" == true ]]; then
    return
  fi
  cleaned_up=true

  if [[ -n "${browser_pid}" ]] && kill -0 "${browser_pid}" 2>/dev/null; then
    kill -- "-${browser_pid}" 2>/dev/null || true
  fi

  for pid in "${service_pids[@]}"; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill -- "-${pid}" 2>/dev/null || true
    fi
  done

  for _ in {1..20}; do
    local running=false
    for pid in "${service_pids[@]}"; do
      kill -0 "${pid}" 2>/dev/null && running=true
    done
    [[ "${running}" == false ]] && break
    sleep 0.1
  done

  for pid in "${service_pids[@]}"; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill -KILL -- "-${pid}" 2>/dev/null || true
    fi
  done

  rm -f "${PID_FILE}" "${SERVICE_PID_FILE}"
}

trap cleanup EXIT
trap 'exit 0' INT TERM HUP

has_module music && start_service \
  "Música e imagem" \
  "${PROJECT_DIR}/api" \
  env HOST=127.0.0.1 PORT=3333 npm run dev

has_module voice && start_service \
  "Voz e TTS" \
  "${PROJECT_DIR}/api-tts" \
  "${PROJECT_DIR}/api-tts/.venv/bin/python" -m uvicorn main:app --host 127.0.0.1 --port 3334

has_module video && start_service \
  "Vídeo" \
  "${PROJECT_DIR}/api-video" \
  env VIDEO_HOST=127.0.0.1 VIDEO_PORT=3335 npm run dev

start_service \
  "Interface" \
  "${PROJECT_DIR}" \
  env \
    VITE_MUSIC_API_URL=http://127.0.0.1:3333 \
    VITE_TTS_API_URL=http://127.0.0.1:3334 \
    VITE_VIDEO_API_URL=http://127.0.0.1:3335 \
    npm run dev -- --host 127.0.0.1 --port 5173 --strictPort

wait_for_url() {
  local url="$1"
  for _ in {1..120}; do
    curl -fsS "${url}" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  return 1
}

failed_services=()
wait_for_url "${APP_URL}" || failed_services+=("interface")
has_module music && ! wait_for_url "http://127.0.0.1:3333/health" && failed_services+=("música e imagem")
has_module voice && ! wait_for_url "http://127.0.0.1:3334/health" && failed_services+=("voz")
has_module video && ! wait_for_url "http://127.0.0.1:3335/health" && failed_services+=("vídeo")

if (( ${#failed_services[@]} > 0 )); then
  zenity --error \
    --title="Falha ao iniciar o Zenith" \
    --text="Não iniciaram: ${failed_services[*]}.\n\nConsulte o log em:\n${LOG_FILE}"
  exit 1
fi

printf '\n[Navegador]\n' >>"${LOG_FILE}"
setsid brave-browser \
  --user-data-dir="${PROFILE_DIR}" \
  --app="${APP_URL}" \
  --class=Zenith \
  --disable-background-mode \
  --no-first-run \
  >>"${LOG_FILE}" 2>&1 &
browser_pid=$!

wait "${browser_pid}" 2>/dev/null || true
