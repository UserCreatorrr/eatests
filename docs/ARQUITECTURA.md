# Marginbite · Arquitectura v2

Reconstrucción de los cimientos (rama `rebuild/v2`). Se conserva el stack
(Next.js 14 + SQLite en `/data` + Easypanel) y las pantallas; se rehace todo
lo que hay debajo.

## Por qué

La v1 nació como destino de lo que mandaba n8n desde exports de TSpoonLab
(`lib/db.ts`: *"Column names match EXACTLY what node 12. Preparar Payload
sends"*). Sin modelo de dominio, cada arreglo era un parche en una ruta:

| v1 | Consecuencia |
|---|---|
| 0 claves foráneas de negocio, 3 UNIQUE | Duplicados, huérfanos, referencias entre clientes |
| 43 `ALTER TABLE` en try/catch, sin migraciones | Nadie sabe qué esquema tiene una BD concreta |
| 279 consultas SQL repartidas en 43 rutas | La misma regla escrita de cinco formas distintas |
| Endpoint genérico que expone 17 tablas | Sin reglas de negocio por entidad |
| Estados como texto libre | Albarán "validado" con 0 líneas |
| 0 tests | Cada cambio rompe algo que nadie ve |

## Principios

1. **La base de datos impide el error**, no la pantalla. Claves foráneas,
   `UNIQUE`, `CHECK` y triggers. La IA puede leer mal un albarán; la BD no
   puede dejar que eso se convierta en un coste falso.
2. **Aislamiento multi-cliente garantizado por la BD.** Toda tabla de negocio
   lleva `org_id` y las referencias son claves compuestas `(org_id, id)`: es
   imposible enlazar un ingrediente de un cliente en la receta de otro.
3. **Una sola definición de cada regla**, en `server/domain` (puro, sin BD) o
   `server/services` (casos de uso con transacción).
4. **Rutas finas.** Una ruta autentica, valida la entrada con zod y llama a
   un servicio. Nada de SQL en `app/api`.
5. **Errores con formato único:** `{ "error": { "code", "message", "details" } }`.
6. **Esquema versionado:** migraciones numeradas, aplicadas en transacción y
   registradas con su checksum. Una migración aplicada no se edita jamás.
7. **Todo con test.** El núcleo (coste, estados, aislamiento, migración) se
   prueba contra SQLite real en memoria.

## Capas

```
app/api/**/route.ts     HTTP fino: auth + zod + llamada al servicio
server/http/            route(): contexto, validación, sobre de errores
server/services/        casos de uso, transacciones, máquinas de estado
server/repos/           acceso a datos, una por agregado, siempre por org
server/domain/          puro: unidades, dinero, fechas, coste, estados, errores
server/db/              conexión, pragmas, migraciones
server/legacy/          migración v1 -> v2
tests/                  vitest: unit (domain) + integración (servicios)
```

## Modelo de datos (resumen)

- **Identidad:** `users`, `organizations`, `memberships` (rol por organización),
  `sessions` (revocables: cerrar sesión invalida el token).
- **Estructura:** `locations` (centros), `warehouses` (almacenes).
- **Catálogo:** `suppliers` (único por NIF normalizado), `ingredients` (único por
  nombre; unidad del catálogo cerrado), `tools`, `price_observations`.
- **Escandallo:** `recipes` (`dish` | `preparation`), `recipe_lines` (ingrediente,
  subreceta o línea libre: exactamente una; merma por línea).
- **Compras:** `purchase_orders` (`draft → sent → received → closed`),
  `delivery_notes` (`draft → review → validated → invoiced`; único por
  proveedor + número; no se valida sin líneas ni si las líneas no cuadran con la
  base), `invoices` (agrupa albaranes; albarán facturado = bloqueado).
- **Stock:** `stock_movements`, libro mayor de solo inserción (un trigger impide
  modificar o borrar). El stock es la suma de movimientos.
- **Labor:** `employees`, `shifts`, `sales_slots`, `labor_targets`.
- **Sistema:** `notifications`, `push_subscriptions`, `report_*`, `audit_log`.

Convenios: importes de documentos en **céntimos enteros** (`*_cents`); precios
unitarios en euros `REAL`; fechas de negocio `YYYY-MM-DD`; marcas de tiempo
ISO-8601 UTC; unidades del catálogo cerrado `kg g mg l cl ml ud docena`.

## Migración de datos v1 → v2

`server/legacy/migrate-v1.ts` lee la BD v1 **sin modificarla** y escribe una BD
v2 nueva. Cada usuario pasa a ser una organización. Nada se borra en silencio:
lo que no encaja en las reglas nuevas se conserva, se marca para revisar y se
anota en el informe de migración (duplicados, unidades sin equivalencia, líneas
huérfanas, documentos que no cuadran).

## Calidad

`npm run check` = TypeScript estricto + ESLint + tests. Debe pasar antes de
cada commit a `master`.
