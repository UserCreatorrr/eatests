# Despliegue de Marginbite v2

Easypanel no despliega solo: tras el push a GitHub hay que pulsar **Deploy** en el
servicio `marginbites`. La base de datos vive en el volumen `/data` del contenedor.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `JWT_SECRET` | sí | firma de sesiones. Sin ella en producción la app no arranca. |
| `APP_SECRET` | sí | cifrado de secretos en BD (token de Gmail). Si falta se usa `JWT_SECRET`. |
| `ADMIN_SECRET` | recomendable | autoriza `GET /api/admin/backup` (copia consistente de la BD). |
| `DB_PATH` | sí | `/data/marginbite-v2.db` |
| `NEXT_PUBLIC_APP_URL` | sí | URL pública, para OAuth y los enlaces de los emails. |
| `OPENAI_API_KEY` | para IA | escaneo de documentos, onboarding, asistente, voz. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | para Google | login con Google y envío de pedidos por Gmail. Callback de Gmail: `${NEXT_PUBLIC_APP_URL}/api/messaging/email/callback`. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | para push | notificaciones push. |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | para WhatsApp | envío de pedidos por WhatsApp. |

## Migración de v1 a v2 (una sola vez)

La v2 usa una BD nueva. La v1 (`/data/marginbites.db`) no se toca y queda como copia.

1. Copia consistente de la v1 dentro del contenedor actual (no `cp`: hay WAL abierto):
   ```bash
   node -e "require('better-sqlite3')('/data/marginbites.db').backup('/data/marginbites-backup-$(date +%F).db')"
   ```
2. Desplegar la v2 (la app crea `/data/marginbite-v2.db` vacía al arrancar).
3. Migrar en el contenedor nuevo:
   ```bash
   npx tsx scripts/migrate-v1.ts /data/marginbites-backup-<fecha>.db /data/marginbite-v2.db /data/informe-migracion.json
   ```
   El script se niega a escribir sobre una BD con datos: si la v2 ya tiene filas, borrarla y repetir.
4. Leer el informe: totales de facturas y ventas por organización deben coincidir con la v1 al céntimo (se comprobó sobre la copia real de producción: 7 organizaciones, 256 incidencias explicadas, ninguna pérdida de dinero).
5. Reiniciar el servicio y comprobar `GET /api/health` → `{ ok: true, schema: 1 }`.

Incidencias conocidas de los datos reales:
- Makro aparece dos veces en una organización porque los NIF de origen difieren (A28647451 y A28647541, error de OCR). Se migran como dos proveedores; unificar desde la ficha.
- Los turnos triplicados de Factorial se deduplican por clave natural (fecha, persona, horario).

## Vuelta atrás

La imagen anterior sigue en Easypanel y la v1 sigue en `/data/marginbites.db`: volver a desplegar
el commit anterior (`master` antes de `rebuild/v2`) con `DB_PATH=/data/marginbites.db`.

## Comprobaciones antes de cada deploy

```bash
npm run check          # tsc + lint + tests
npm run build
```

## Herramientas

- `npx tsx scripts/set-password.ts <db> <email> <password>`: cambia una contraseña y revoca sesiones.
- `curl -H "Authorization: Bearer $ADMIN_SECRET" https://<host>/api/admin/backup -o copia.db`: copia consistente de la BD.
