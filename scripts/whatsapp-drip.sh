#!/usr/bin/env bash
# Roda o enviador da fila de WhatsApp com o WAHA do CRM (DeskComm) da VPS.
# Sessão = número oficial da academia. Chave lida do .env do CRM (não copiada).
set -euo pipefail
# cron roda com PATH mínimo: node (nvm) e docker explícitos
export PATH="/root/.nvm/versions/node/v22.23.2/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.."
export GF_WAHA_URL="http://$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' deskcomm-waha-1 | awk '{print $1}'):3000"
export GF_WAHA_KEY="$(grep -hE '^WAHA_API_KEY=' /root/stacks/deskcomm/.env | head -1 | cut -d= -f2- | tr -d '"')"
export GF_WAHA_SESSION="${GF_WAHA_SESSION:-org_6806bcbb_427079208d2d4fc58f053b8a3fa17b93}"
exec node scripts/whatsapp-drip.mjs "$@"
