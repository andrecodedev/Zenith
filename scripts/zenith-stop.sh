#!/usr/bin/env bash

set -u

PROJECT_DIR="/home/usuario/Documentos/projetos-pessoais/zenith"
STATE_DIR="${HOME}/.local/state/zenith"
PID_FILE="${STATE_DIR}/launcher.pid"
SERVICE_PID_FILE="${STATE_DIR}/services.pids"
stopped=false

if [[ -f "${PID_FILE}" ]]; then
  launcher_pid="$(<"${PID_FILE}")"
  if [[ "${launcher_pid}" =~ ^[0-9]+$ ]] && kill -0 "${launcher_pid}" 2>/dev/null; then
    launcher_command="$(ps -p "${launcher_pid}" -o args= 2>/dev/null || true)"
    if [[ "${launcher_command}" == *"zenith-launcher.sh"* ]]; then
      kill -TERM "${launcher_pid}" 2>/dev/null || true
      stopped=true
    fi
  fi
fi

sleep 1

if [[ -f "${SERVICE_PID_FILE}" ]]; then
  while IFS= read -r service_pid; do
    [[ "${service_pid}" =~ ^[0-9]+$ ]] || continue
    kill -0 "${service_pid}" 2>/dev/null || continue

    service_cwd="$(readlink -f "/proc/${service_pid}/cwd" 2>/dev/null || true)"
    if [[ "${service_cwd}" == "${PROJECT_DIR}"* ]]; then
      kill -TERM -- "-${service_pid}" 2>/dev/null || true
      stopped=true
    fi
  done <"${SERVICE_PID_FILE}"
fi

rm -f "${PID_FILE}" "${SERVICE_PID_FILE}"

if [[ "${stopped}" == true ]]; then
  if command -v notify-send >/dev/null; then
    notify-send "Zenith" "Aplicativo e serviços locais encerrados."
  fi
else
  zenity --info \
    --title="Zenith" \
    --text="O Zenith não estava em execução."
fi
