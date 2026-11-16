#!/usr/bin/env bash
# Control del servicio en Easypanel por API (tRPC). El token vive fuera del repo:
#   ~/.easypanel-marginbite.token
# Uso:
#   scripts/easypanel.sh status            commit desplegado, rama y estado
#   scripts/easypanel.sh deploy [--force]  lanza un deploy de la rama configurada
#   scripts/easypanel.sh env               nombres de variables (sin valores)
#   scripts/easypanel.sh env-set K=V ...   añade o cambia variables y las guarda
#   scripts/easypanel.sh ref <rama>        cambia la rama de GitHub que se despliega
#   (logs: por ssh, docker service logs marginbites_marginbites)
set -euo pipefail
# Git Bash en Windows convierte '/data/x' en 'C:/Program Files/Git/data/x' al pasarlo a
# programas nativos (python, curl). Ya rompió DB_PATH una vez: desactivado.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
PANEL="${EASYPANEL_URL:-http://72.62.237.66:3000}"
PROJECT="${EASYPANEL_PROJECT:-marginbites}"
SERVICE="${EASYPANEL_SERVICE:-marginbites}"
TOKEN_FILE="${EASYPANEL_TOKEN_FILE:-$HOME/.easypanel-marginbite.token}"
[ -f "$TOKEN_FILE" ] || { echo "Falta el token en $TOKEN_FILE" >&2; exit 1; }
TOKEN=$(tr -d '\r\n' < "$TOKEN_FILE")

enc() { python -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))" "$1"; }
query() { curl -sf -m 30 -H "Authorization: Bearer $TOKEN" "$PANEL/api/trpc/$1?input=$(enc "$2")"; }
mutate() { curl -sf -m 120 -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -X POST -d "$2" "$PANEL/api/trpc/$1"; }
SVC="{\"json\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\"}}"

case "${1:-status}" in
  status)
    query services.app.inspectService "$SVC" | python -X utf8 -c "
import sys,json; d=json.load(sys.stdin)['json']
print('rama   :', d['source']['owner']+'/'+d['source']['repo'], '@', d['source']['ref'], '(autoDeploy', d['source']['autoDeploy'], ')')
c=d.get('commit') or {}
print('commit :', (c.get('sha') or '?')[:7], '·', (c.get('commit',{}).get('message') or '').splitlines()[0][:80])
print('build  :', d['build']); print('volumen:', d['mounts'])" ;;
  deploy)
    FORCE=false; [ "${2:-}" = "--force" ] && FORCE=true
    mutate services.app.deployService "{\"json\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\",\"forceRebuild\":$FORCE}}" >/dev/null && echo "Deploy lanzado (rama $(query services.app.inspectService "$SVC" | python -c "import sys,json;print(json.load(sys.stdin)['json']['source']['ref'])"))" ;;
  env)
    query services.app.inspectService "$SVC" | python -c "import sys,json;print('\n'.join(l.split('=')[0] for l in json.load(sys.stdin)['json'].get('env','').splitlines() if l.strip()))" ;;
  env-set)
    shift; CUR=$(query services.app.inspectService "$SVC" | python -c "import sys,json;print(json.load(sys.stdin)['json'].get('env',''))")
    NEW=$(python - "$CUR" "$@" <<'PY'
import sys
cur=sys.argv[1]; updates=dict(a.split('=',1) for a in sys.argv[2:])
lines=[l for l in cur.splitlines() if l.strip()]
out=[]; seen=set()
for l in lines:
    k=l.split('=',1)[0]
    if k in updates: out.append(f"{k}={updates[k]}"); seen.add(k)
    else: out.append(l)
for k,v in updates.items():
    if k not in seen: out.append(f"{k}={v}")
print('\n'.join(out))
PY
)
    mutate services.app.updateEnv "$(python -c "import sys,json;print(json.dumps({'json':{'projectName':sys.argv[1],'serviceName':sys.argv[2],'env':sys.argv[3]}}))" "$PROJECT" "$SERVICE" "$NEW")" >/dev/null && echo "Variables guardadas: $*" | sed -E 's/=[^ ]*/=…/g' ;;
  ref)
    [ -n "${2:-}" ] || { echo "Falta la rama" >&2; exit 1; }
    mutate services.app.updateSourceGithub "{\"json\":{\"projectName\":\"$PROJECT\",\"serviceName\":\"$SERVICE\",\"owner\":\"UserCreatorrr\",\"repo\":\"eatests\",\"ref\":\"$2\",\"path\":\"/\",\"autoDeploy\":false}}" >/dev/null && echo "Rama cambiada a $2" ;;
  *) echo "Orden desconocida: $1" >&2; exit 1 ;;
esac
