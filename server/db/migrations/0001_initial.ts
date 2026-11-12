// Esquema inicial de la v2.
//
// Reglas que aplica la propia base de datos, no la pantalla:
//  - Aislamiento: toda tabla de negocio lleva org_id y las referencias son
//    claves compuestas (org_id, id). No se puede enlazar un registro de una
//    organización con el de otra aunque se conozca su id.
//  - Unidades del catálogo cerrado, fechas YYYY-MM-DD, importes no negativos.
//  - Unicidad de negocio: proveedor por NIF y por nombre, ingrediente y receta
//    por nombre, albarán y factura por proveedor + número, pedido por número.
//  - Línea de escandallo: exactamente uno de ingrediente / subreceta / libre.
//  - Albarán: no se valida sin líneas; validado o facturado = bloqueado.
//  - Stock: libro mayor de solo inserción.
//
// Una referencia compuesta no admite ON DELETE SET NULL (anularía también
// org_id), así que lo referenciado no se borra: se desactiva (`active = 0`).

const UNITS = `('kg','g','mg','l','cl','ml','ud','docena')`
const DATE = (c: string) => `(${c} IS NULL OR ${c} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')`
const TIME = (c: string) => `(${c} IS NULL OR ${c} GLOB '[0-2][0-9]:[0-5][0-9]')`
const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
const BOOL = (c: string) => `${c} INTEGER NOT NULL DEFAULT 1 CHECK (${c} IN (0,1))`

export const sql = /* sql */ `
-- ───────────────────────── Identidad ─────────────────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (email LIKE '%_@_%'),
  password_hash TEXT,
  name          TEXT,
  google_sub    TEXT UNIQUE,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT ${NOW},
  updated_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE organizations (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE memberships (
  org_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('owner','manager','staff')),
  created_at TEXT    NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX memberships_user ON memberships(user_id);

-- Una fila por sesión iniciada: cerrar sesión la revoca y el token deja de valer.
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT ${NOW},
  expires_at TEXT    NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip         TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

-- ───────────────────────── Estructura ─────────────────────────
CREATE TABLE locations (
  id     INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code   TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(code)) > 0),
  name   TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  city   TEXT,
  ${BOOL('active')},
  created_at TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, code),
  UNIQUE (org_id, id)
);

CREATE TABLE warehouses (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id INTEGER,
  name        TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  kind        TEXT    NOT NULL DEFAULT 'other' CHECK (kind IN ('refrigerated','frozen','dry','other')),
  ${BOOL('active')},
  created_at  TEXT    NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, name),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id)
);

-- ───────────────────────── Catálogo ─────────────────────────
CREATE TABLE suppliers (
  id                INTEGER PRIMARY KEY,
  org_id            INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  -- NIF normalizado (mayúsculas, sin guiones ni espacios): la identidad real.
  tax_id            TEXT    CHECK (tax_id IS NULL OR tax_id GLOB '[A-Z0-9]*'),
  contact_name      TEXT,
  email             TEXT,
  phone             TEXT,
  address           TEXT,
  city              TEXT,
  postal_code       TEXT,
  website           TEXT,
  notes             TEXT,
  preferred_channel TEXT CHECK (preferred_channel IS NULL OR preferred_channel IN ('email','whatsapp','phone')),
  ${BOOL('active')},
  created_at        TEXT NOT NULL DEFAULT ${NOW},
  updated_at        TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, name),
  UNIQUE (org_id, tax_id),
  UNIQUE (org_id, id)
);

CREATE TABLE ingredients (
  id                     INTEGER PRIMARY KEY,
  org_id                 INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                   TEXT,
  name                   TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  category               TEXT,
  base_unit              TEXT    NOT NULL CHECK (base_unit IN ${UNITS}),
  -- Precio de compra en euros por unidad base (€/kg, €/l, €/ud).
  cost                   REAL    CHECK (cost IS NULL OR cost >= 0),
  cost_updated_at        TEXT,
  vat_rate               REAL    CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  supplier_id            INTEGER,
  warehouse_id           INTEGER,
  secondary_warehouse_id INTEGER,
  -- Peso medio de una unidad, para usar "1 huevo" en una receta en gramos.
  avg_unit_weight_g      REAL    CHECK (avg_unit_weight_g IS NULL OR avg_unit_weight_g > 0),
  notes                  TEXT,
  ${BOOL('active')},
  created_at             TEXT NOT NULL DEFAULT ${NOW},
  updated_at             TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, name),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, supplier_id)            REFERENCES suppliers(org_id, id),
  FOREIGN KEY (org_id, warehouse_id)           REFERENCES warehouses(org_id, id),
  FOREIGN KEY (org_id, secondary_warehouse_id) REFERENCES warehouses(org_id, id)
);
CREATE INDEX ingredients_supplier ON ingredients(org_id, supplier_id);

-- Cada precio visto: en un albarán, una factura, a mano o importado.
CREATE TABLE price_observations (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ingredient_id  INTEGER,
  supplier_id    INTEGER,
  description    TEXT    NOT NULL,
  qty            REAL    CHECK (qty IS NULL OR qty > 0),
  unit           TEXT    CHECK (unit IS NULL OR unit IN ${UNITS}),
  unit_price     REAL    NOT NULL CHECK (unit_price >= 0),
  line_total     REAL    CHECK (line_total IS NULL OR line_total >= 0),
  previous_price REAL,
  observed_on    TEXT    NOT NULL CHECK ${DATE('observed_on')},
  source_type    TEXT    NOT NULL CHECK (source_type IN ('delivery_note','invoice','manual','import','legacy')),
  source_id      INTEGER,
  created_at     TEXT    NOT NULL DEFAULT ${NOW},
  FOREIGN KEY (org_id, ingredient_id) REFERENCES ingredients(org_id, id),
  FOREIGN KEY (org_id, supplier_id)   REFERENCES suppliers(org_id, id)
);
CREATE INDEX price_obs_ingredient ON price_observations(org_id, ingredient_id, observed_on);

CREATE TABLE tools (
  id       INTEGER PRIMARY KEY,
  org_id   INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code     TEXT,
  name     TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  category TEXT,
  unit     TEXT    NOT NULL DEFAULT 'ud' CHECK (unit IN ${UNITS}),
  cost     REAL    CHECK (cost IS NULL OR cost >= 0),
  ${BOOL('active')},
  created_at TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, id)
);

-- ───────────────────────── Escandallo ─────────────────────────
CREATE TABLE recipes (
  id                INTEGER PRIMARY KEY,
  org_id            INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code              TEXT,
  name              TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  category          TEXT,
  -- dish = plato que se vende; preparation = elaboración que se usa en otras.
  kind              TEXT    NOT NULL DEFAULT 'dish' CHECK (kind IN ('dish','preparation')),
  portions          INTEGER NOT NULL DEFAULT 1 CHECK (portions > 0),
  yield_qty         REAL    CHECK (yield_qty IS NULL OR yield_qty > 0),
  yield_unit        TEXT    CHECK (yield_unit IS NULL OR yield_unit IN ${UNITS}),
  portion_weight_g  REAL    CHECK (portion_weight_g IS NULL OR portion_weight_g > 0),
  sale_price        REAL    CHECK (sale_price IS NULL OR sale_price >= 0),
  -- Merma general del plato terminado (sobras, roturas), aparte de la de cada línea.
  general_waste_pct REAL    CHECK (general_waste_pct IS NULL OR (general_waste_pct >= 0 AND general_waste_pct <= 95)),
  description       TEXT,
  allergens         TEXT,
  procedure_json    TEXT    CHECK (procedure_json IS NULL OR json_valid(procedure_json)),
  conservation      TEXT,
  regeneration      TEXT,
  notes             TEXT,
  source            TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','excel','ai','legacy')),
  ${BOOL('active')},
  created_at        TEXT NOT NULL DEFAULT ${NOW},
  updated_at        TEXT NOT NULL DEFAULT ${NOW},
  CHECK ((yield_qty IS NULL) = (yield_unit IS NULL)),
  UNIQUE (org_id, name),
  UNIQUE (org_id, id)
);

CREATE TABLE recipe_lines (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipe_id      INTEGER NOT NULL,
  ingredient_id  INTEGER,
  sub_recipe_id  INTEGER,
  free_name      TEXT,
  free_unit_cost REAL    CHECK (free_unit_cost IS NULL OR free_unit_cost >= 0),
  -- Cantidad NETA (la que acaba en el plato). El coste va sobre la bruta:
  -- qty / (1 - waste_pct/100).
  qty            REAL    NOT NULL CHECK (qty > 0),
  unit           TEXT    NOT NULL CHECK (unit IN ${UNITS}),
  waste_pct      REAL    NOT NULL DEFAULT 0 CHECK (waste_pct >= 0 AND waste_pct <= 95),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  note           TEXT,
  created_at     TEXT    NOT NULL DEFAULT ${NOW},
  CHECK ((ingredient_id IS NOT NULL) + (sub_recipe_id IS NOT NULL) + (free_name IS NOT NULL) = 1),
  CHECK (sub_recipe_id IS NULL OR sub_recipe_id <> recipe_id),
  FOREIGN KEY (org_id, recipe_id)     REFERENCES recipes(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, ingredient_id) REFERENCES ingredients(org_id, id),
  FOREIGN KEY (org_id, sub_recipe_id) REFERENCES recipes(org_id, id)
);
CREATE INDEX recipe_lines_recipe     ON recipe_lines(org_id, recipe_id, sort_order);
CREATE INDEX recipe_lines_ingredient ON recipe_lines(org_id, ingredient_id);
CREATE INDEX recipe_lines_sub        ON recipe_lines(org_id, sub_recipe_id);

-- ───────────────────────── Imágenes de documentos ─────────────────────────
-- Aparte para que los listados no arrastren varios MB por fila.
CREATE TABLE document_images (
  id         INTEGER PRIMARY KEY,
  org_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mime       TEXT    NOT NULL,
  data       TEXT    NOT NULL,
  bytes      INTEGER NOT NULL CHECK (bytes > 0),
  created_at TEXT    NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, id)
);

-- ───────────────────────── Compras ─────────────────────────
CREATE TABLE purchase_orders (
  id                   INTEGER PRIMARY KEY,
  org_id               INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number               TEXT    NOT NULL CHECK (length(trim(number)) > 0),
  supplier_id          INTEGER NOT NULL,
  location_id          INTEGER,
  status               TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','received','closed','cancelled')),
  order_date           TEXT    NOT NULL CHECK ${DATE('order_date')},
  expected_date        TEXT    CHECK ${DATE('expected_date')},
  sent_at              TEXT,
  sent_via             TEXT    CHECK (sent_via IS NULL OR sent_via IN ('email','whatsapp','manual')),
  -- Total declarado sin líneas (pedidos antiguos). Con líneas, el total se calcula.
  declared_total_cents INTEGER CHECK (declared_total_cents IS NULL OR declared_total_cents >= 0),
  notes                TEXT,
  created_by           TEXT,
  created_at           TEXT NOT NULL DEFAULT ${NOW},
  updated_at           TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, number),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, supplier_id) REFERENCES suppliers(org_id, id),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id)
);

CREATE TABLE purchase_order_lines (
  id                 INTEGER PRIMARY KEY,
  org_id             INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id           INTEGER NOT NULL,
  ingredient_id      INTEGER,
  description        TEXT    NOT NULL CHECK (length(trim(description)) > 0),
  qty                REAL    NOT NULL CHECK (qty > 0),
  unit               TEXT    NOT NULL CHECK (unit IN ${UNITS}),
  unit_cost_estimate REAL    CHECK (unit_cost_estimate IS NULL OR unit_cost_estimate >= 0),
  warehouse_id       INTEGER,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (org_id, order_id)      REFERENCES purchase_orders(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, ingredient_id) REFERENCES ingredients(org_id, id),
  FOREIGN KEY (org_id, warehouse_id)  REFERENCES warehouses(org_id, id)
);
CREATE INDEX po_lines_order ON purchase_order_lines(org_id, order_id);

CREATE TABLE invoices (
  id              INTEGER PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id     INTEGER NOT NULL,
  number          TEXT    NOT NULL CHECK (length(trim(number)) > 0),
  invoice_date    TEXT    NOT NULL CHECK ${DATE('invoice_date')},
  due_date        TEXT    CHECK ${DATE('due_date')},
  accounting_date TEXT    CHECK ${DATE('accounting_date')},
  base_cents      INTEGER NOT NULL DEFAULT 0 CHECK (base_cents >= 0),
  vat_cents       INTEGER NOT NULL DEFAULT 0 CHECK (vat_cents >= 0),
  total_cents     INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_on         TEXT    CHECK ${DATE('paid_on')},
  payment_method  TEXT,
  -- 0 = alguna línea sin mapear a ingrediente; 1 = todas resueltas.
  lines_resolved  INTEGER NOT NULL DEFAULT 0 CHECK (lines_resolved IN (0,1)),
  image_id        INTEGER,
  source          TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','scan','legacy')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT ${NOW},
  updated_at      TEXT NOT NULL DEFAULT ${NOW},
  CHECK (status = 'paid' OR paid_on IS NULL),
  UNIQUE (org_id, supplier_id, number),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, supplier_id) REFERENCES suppliers(org_id, id),
  FOREIGN KEY (org_id, image_id)    REFERENCES document_images(org_id, id)
);

CREATE TABLE invoice_lines (
  id                INTEGER PRIMARY KEY,
  org_id            INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id        INTEGER NOT NULL,
  ingredient_id     INTEGER,
  description       TEXT    NOT NULL,
  qty               REAL    CHECK (qty IS NULL OR qty > 0),
  unit              TEXT    CHECK (unit IS NULL OR unit IN ${UNITS}),
  unit_price        REAL    CHECK (unit_price IS NULL OR unit_price >= 0),
  vat_rate          REAL    CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  line_total_cents  INTEGER CHECK (line_total_cents IS NULL OR line_total_cents >= 0),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (org_id, invoice_id)    REFERENCES invoices(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, ingredient_id) REFERENCES ingredients(org_id, id)
);
CREATE INDEX invoice_lines_invoice ON invoice_lines(org_id, invoice_id);

CREATE TABLE delivery_notes (
  id                INTEGER PRIMARY KEY,
  org_id            INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       INTEGER NOT NULL,
  number            TEXT    NOT NULL CHECK (length(trim(number)) > 0),
  delivery_date     TEXT    NOT NULL CHECK ${DATE('delivery_date')},
  purchase_order_id INTEGER,
  invoice_id        INTEGER,
  status            TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','validated','invoiced')),
  base_cents        INTEGER NOT NULL DEFAULT 0 CHECK (base_cents >= 0),
  vat_cents         INTEGER NOT NULL DEFAULT 0 CHECK (vat_cents >= 0),
  total_cents       INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  image_id          INTEGER,
  source            TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','scan','order','legacy')),
  received_by       TEXT,
  notes             TEXT,
  validated_at      TEXT,
  validated_by      TEXT,
  created_at        TEXT NOT NULL DEFAULT ${NOW},
  updated_at        TEXT NOT NULL DEFAULT ${NOW},
  -- Facturado <=> enlazado a una factura. Un albarán solo puede estar en una.
  CHECK ((status = 'invoiced') = (invoice_id IS NOT NULL)),
  UNIQUE (org_id, supplier_id, number),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, supplier_id)       REFERENCES suppliers(org_id, id),
  FOREIGN KEY (org_id, purchase_order_id) REFERENCES purchase_orders(org_id, id),
  FOREIGN KEY (org_id, invoice_id)        REFERENCES invoices(org_id, id),
  FOREIGN KEY (org_id, image_id)          REFERENCES document_images(org_id, id)
);
CREATE INDEX delivery_notes_invoice ON delivery_notes(org_id, invoice_id);
CREATE INDEX delivery_notes_date    ON delivery_notes(org_id, delivery_date);

CREATE TABLE delivery_note_lines (
  id                  INTEGER PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delivery_note_id    INTEGER NOT NULL,
  ingredient_id       INTEGER,
  description         TEXT    NOT NULL,
  qty                 REAL    CHECK (qty IS NULL OR qty > 0),
  unit                TEXT    CHECK (unit IS NULL OR unit IN ${UNITS}),
  unit_price          REAL    CHECK (unit_price IS NULL OR unit_price >= 0),
  previous_unit_price REAL,
  vat_rate            REAL    CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  line_total_cents    INTEGER CHECK (line_total_cents IS NULL OR line_total_cents >= 0),
  warehouse_id        INTEGER,
  lot                 TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (org_id, delivery_note_id) REFERENCES delivery_notes(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, ingredient_id)    REFERENCES ingredients(org_id, id),
  FOREIGN KEY (org_id, warehouse_id)     REFERENCES warehouses(org_id, id)
);
CREATE INDEX dn_lines_note       ON delivery_note_lines(org_id, delivery_note_id);
CREATE INDEX dn_lines_ingredient ON delivery_note_lines(org_id, ingredient_id);

-- Un albarán no pasa a validado sin líneas.
CREATE TRIGGER delivery_note_validate_requires_lines
BEFORE UPDATE OF status ON delivery_notes
WHEN NEW.status = 'validated' AND NOT EXISTS (
  SELECT 1 FROM delivery_note_lines WHERE delivery_note_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'DELIVERY_NOTE_WITHOUT_LINES');
END;

-- Validado o facturado = bloqueado: sus líneas no se tocan.
CREATE TRIGGER delivery_note_lines_locked_insert
BEFORE INSERT ON delivery_note_lines
WHEN (SELECT status FROM delivery_notes WHERE id = NEW.delivery_note_id) IN ('validated','invoiced')
BEGIN
  SELECT RAISE(ABORT, 'DELIVERY_NOTE_LOCKED');
END;
CREATE TRIGGER delivery_note_lines_locked_update
BEFORE UPDATE ON delivery_note_lines
WHEN (SELECT status FROM delivery_notes WHERE id = OLD.delivery_note_id) IN ('validated','invoiced')
BEGIN
  SELECT RAISE(ABORT, 'DELIVERY_NOTE_LOCKED');
END;
CREATE TRIGGER delivery_note_lines_locked_delete
BEFORE DELETE ON delivery_note_lines
WHEN (SELECT status FROM delivery_notes WHERE id = OLD.delivery_note_id) IN ('validated','invoiced')
BEGIN
  SELECT RAISE(ABORT, 'DELIVERY_NOTE_LOCKED');
END;

-- ───────────────────────── Ventas (documental) ─────────────────────────
CREATE TABLE sales_documents (
  id              INTEGER PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            TEXT    NOT NULL CHECK (kind IN ('delivery_note','invoice')),
  number          TEXT,
  customer_name   TEXT,
  customer_type   TEXT,
  customer_tax_id TEXT,
  doc_date        TEXT    CHECK ${DATE('doc_date')},
  due_date        TEXT    CHECK ${DATE('due_date')},
  base_cents      INTEGER NOT NULL DEFAULT 0 CHECK (base_cents >= 0),
  vat_cents       INTEGER NOT NULL DEFAULT 0 CHECK (vat_cents >= 0),
  total_cents     INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  paid            INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0,1)),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX sales_documents_org ON sales_documents(org_id, kind, doc_date);

-- ───────────────────────── Stock ─────────────────────────
-- Libro mayor de solo inserción. El stock es la suma de movimientos; un
-- error se corrige con un movimiento de ajuste, nunca editando el pasado.
CREATE TABLE stock_movements (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL,
  warehouse_id  INTEGER,
  -- En la unidad base del ingrediente. Positivo entra, negativo sale.
  qty           REAL    NOT NULL CHECK (qty <> 0),
  unit_cost     REAL    CHECK (unit_cost IS NULL OR unit_cost >= 0),
  kind          TEXT    NOT NULL CHECK (kind IN ('receipt','waste','production','transfer','adjustment','count')),
  source_type   TEXT,
  source_id     INTEGER,
  occurred_at   TEXT    NOT NULL,
  note          TEXT,
  created_by    TEXT,
  created_at    TEXT    NOT NULL DEFAULT ${NOW},
  FOREIGN KEY (org_id, ingredient_id) REFERENCES ingredients(org_id, id),
  FOREIGN KEY (org_id, warehouse_id)  REFERENCES warehouses(org_id, id)
);
CREATE INDEX stock_movements_item ON stock_movements(org_id, ingredient_id, warehouse_id);
CREATE TRIGGER stock_movements_no_update BEFORE UPDATE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'STOCK_LEDGER_IS_APPEND_ONLY'); END;
CREATE TRIGGER stock_movements_no_delete BEFORE DELETE ON stock_movements
WHEN (SELECT 1 FROM organizations WHERE id = OLD.org_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'STOCK_LEDGER_IS_APPEND_ONLY'); END;

CREATE TABLE waste_records (
  id             INTEGER PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL DEFAULT 'ingredient' CHECK (kind IN ('ingredient','dish')),
  ingredient_id  INTEGER,
  recipe_id      INTEGER,
  description    TEXT    NOT NULL CHECK (length(trim(description)) > 0),
  qty            REAL    NOT NULL CHECK (qty > 0),
  unit           TEXT    NOT NULL CHECK (unit IN ${UNITS}),
  reason         TEXT,
  estimated_cost REAL    CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  occurred_on    TEXT    NOT NULL CHECK ${DATE('occurred_on')},
  location_id    INTEGER,
  warehouse_id   INTEGER,
  service        TEXT,
  notes          TEXT,
  created_by     TEXT,
  created_at     TEXT    NOT NULL DEFAULT ${NOW},
  FOREIGN KEY (org_id, ingredient_id) REFERENCES ingredients(org_id, id),
  FOREIGN KEY (org_id, recipe_id)     REFERENCES recipes(org_id, id),
  FOREIGN KEY (org_id, location_id)   REFERENCES locations(org_id, id),
  FOREIGN KEY (org_id, warehouse_id)  REFERENCES warehouses(org_id, id)
);
CREATE INDEX waste_records_date ON waste_records(org_id, occurred_on);

-- Raciones producidas o vendidas: base del consumo teórico.
CREATE TABLE production_records (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipe_id   INTEGER,
  description TEXT    NOT NULL,
  portions    INTEGER NOT NULL CHECK (portions > 0),
  produced_on TEXT    NOT NULL CHECK ${DATE('produced_on')},
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT ${NOW},
  FOREIGN KEY (org_id, recipe_id) REFERENCES recipes(org_id, id)
);

CREATE TABLE order_templates (
  id           INTEGER PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  period_year  INTEGER,
  period_month INTEGER CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT ${NOW}
);

-- ───────────────────────── Labor ─────────────────────────
CREATE TABLE employees (
  id                  INTEGER PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                TEXT,
  name                TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  location_id         INTEGER,
  role                TEXT,
  contract_type       TEXT,
  hourly_cost         REAL    CHECK (hourly_cost IS NULL OR hourly_cost >= 0),
  employer_cost       REAL    CHECK (employer_cost IS NULL OR employer_cost >= 0),
  contract_hours_week REAL    CHECK (contract_hours_week IS NULL OR (contract_hours_week >= 0 AND contract_hours_week <= 80)),
  ${BOOL('active')},
  created_at          TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (org_id, code),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id)
);

CREATE TABLE shifts (
  id            INTEGER PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id   INTEGER,
  employee_id   INTEGER,
  employee_name TEXT    NOT NULL,
  role          TEXT,
  service       TEXT,
  shift_date    TEXT    NOT NULL CHECK ${DATE('shift_date')},
  start_time    TEXT    NOT NULL CHECK ${TIME('start_time')},
  end_time      TEXT    NOT NULL CHECK ${TIME('end_time')},
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  planned_hours REAL    NOT NULL CHECK (planned_hours >= 0 AND planned_hours <= 24),
  actual_hours  REAL    CHECK (actual_hours IS NULL OR (actual_hours >= 0 AND actual_hours <= 24)),
  hourly_cost   REAL    CHECK (hourly_cost IS NULL OR hourly_cost >= 0),
  overnight     INTEGER NOT NULL DEFAULT 0 CHECK (overnight IN (0,1)),
  source        TEXT,
  created_at    TEXT    NOT NULL DEFAULT ${NOW},
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id),
  FOREIGN KEY (org_id, employee_id) REFERENCES employees(org_id, id)
);
-- Reimportar el mismo cuadrante no duplica turnos.
CREATE UNIQUE INDEX shifts_natural_key ON shifts(org_id, IFNULL(location_id, 0), shift_date, employee_name, start_time, end_time);

CREATE TABLE sales_slots (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id INTEGER,
  sale_date   TEXT    NOT NULL CHECK ${DATE('sale_date')},
  slot_start  TEXT    NOT NULL CHECK ${TIME('slot_start')},
  slot_end    TEXT    CHECK ${TIME('slot_end')},
  channel     TEXT    NOT NULL DEFAULT 'sala',
  net_sales   REAL    NOT NULL DEFAULT 0 CHECK (net_sales >= 0),
  covers      INTEGER CHECK (covers IS NULL OR covers >= 0),
  orders      INTEGER CHECK (orders IS NULL OR orders >= 0),
  tickets     INTEGER CHECK (tickets IS NULL OR tickets >= 0),
  source      TEXT,
  created_at  TEXT    NOT NULL DEFAULT ${NOW},
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id)
);
CREATE UNIQUE INDEX sales_slots_natural_key ON sales_slots(org_id, IFNULL(location_id, 0), sale_date, slot_start, channel);

CREATE TABLE labor_targets (
  id                        INTEGER PRIMARY KEY,
  org_id                    INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id               INTEGER,
  service                   TEXT,
  role                      TEXT,
  target_labor_pct          REAL CHECK (target_labor_pct IS NULL OR (target_labor_pct > 0 AND target_labor_pct <= 100)),
  target_splh               REAL CHECK (target_splh IS NULL OR target_splh >= 0),
  target_sales_per_employee REAL CHECK (target_sales_per_employee IS NULL OR target_sales_per_employee >= 0),
  target_productivity_index REAL,
  min_staff                 INTEGER CHECK (min_staff IS NULL OR min_staff >= 0),
  max_staff                 INTEGER CHECK (max_staff IS NULL OR max_staff >= 0),
  created_at                TEXT NOT NULL DEFAULT ${NOW},
  CHECK (min_staff IS NULL OR max_staff IS NULL OR min_staff <= max_staff),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id)
);

-- ───────────────────────── Informes y avisos ─────────────────────────
CREATE TABLE report_recipients (
  id          INTEGER PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT    NOT NULL COLLATE NOCASE CHECK (email LIKE '%_@_%'),
  name        TEXT,
  role_in_org TEXT,
  scope       TEXT    NOT NULL CHECK (scope IN ('group','location')),
  location_id INTEGER,
  ${BOOL('active')},
  created_at  TEXT NOT NULL DEFAULT ${NOW},
  CHECK (scope = 'group' OR location_id IS NOT NULL),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id)
);

CREATE TABLE report_briefs (
  id           INTEGER PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope        TEXT    NOT NULL,
  location_id  INTEGER,
  brief_date   TEXT    NOT NULL CHECK ${DATE('brief_date')},
  payload_json TEXT    NOT NULL CHECK (json_valid(payload_json)),
  data_quality TEXT,
  created_at   TEXT    NOT NULL DEFAULT ${NOW},
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id)
);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY,
  org_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  urgency    TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','high')),
  link       TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX notifications_user ON notifications(org_id, user_id, read_at);

CREATE TABLE push_subscriptions (
  id         INTEGER PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY,
  org_id    INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id   TEXT,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  data_json TEXT CHECK (data_json IS NULL OR json_valid(data_json)),
  at        TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX audit_log_entity ON audit_log(org_id, entity, entity_id);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`
