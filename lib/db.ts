import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

const DB_PATH =
  process.env.DB_PATH ||
  (process.env.NODE_ENV === 'production' ? '/data/marginbites.db' : './marginbites.db')

fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true })

declare global {
  // eslint-disable-next-line no-var
  var _db: Database.Database | undefined
}

// NEVER lower this value — it would wipe all data on next deploy
const SCHEMA_VERSION = 4

function initSchema(db: Database.Database) {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name          TEXT,
      google_id     TEXT UNIQUE,
      avatar        TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL);
  `)

  const row = db.prepare('SELECT version FROM _schema_version LIMIT 1').get() as { version: number } | undefined
  if (!row) {
    // First time ever — just mark version, tables created below with IF NOT EXISTS
    db.exec(`INSERT INTO _schema_version (version) VALUES (${SCHEMA_VERSION});`)
  } else if (row.version < SCHEMA_VERSION) {
    // Safe migration: only update version, never drop tables
    db.exec(`UPDATE _schema_version SET version = ${SCHEMA_VERSION};`)
  }

  // Column names match EXACTLY what node "12. Preparar Payload" sends to /api/ingest
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredientes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      codi       TEXT,
      descr      TEXT,
      type       TEXT,
      has_data   INTEGER,
      unit       TEXT,
      id_unit    INTEGER,
      cost       REAL,
      color      TEXT
    );

    CREATE TABLE IF NOT EXISTS herramientas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      codi       TEXT,
      descr      TEXT,
      type       TEXT,
      has_data   INTEGER,
      unit       TEXT,
      id_unit    INTEGER,
      cost       REAL
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id),
      codi        TEXT,
      descr       TEXT,
      defecte     INTEGER,
      descr_type  TEXT,
      id_type     TEXT,
      has_other   INTEGER,
      nif         TEXT,
      alt_descr   TEXT,
      comment     TEXT,
      address     TEXT,
      city        TEXT,
      cp          TEXT,
      contact     TEXT,
      phone       TEXT,
      mail        TEXT,
      contact_aux TEXT,
      phone_aux   TEXT,
      mail_aux    TEXT,
      mailcc      TEXT,
      web         TEXT,
      locked      INTEGER,
      replicated  INTEGER
    );

    CREATE TABLE IF NOT EXISTS proveedores_detalle (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id),
      codi        TEXT,
      descr       TEXT,
      nif         TEXT,
      comment     TEXT,
      mail_cc     TEXT,
      web         TEXT,
      creditor    INTEGER,
      address     TEXT,
      city        TEXT,
      cp          TEXT
    );

    CREATE TABLE IF NOT EXISTS lista_pedidos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      descr           TEXT,
      data            TEXT,
      defecte         INTEGER,
      year            INTEGER,
      month           INTEGER,
      pending_send    INTEGER,
      pending_receive INTEGER,
      locked          INTEGER,
      replicated      INTEGER
    );

    CREATE TABLE IF NOT EXISTS pedidos_compra (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      num_order       TEXT,
      vendor          TEXT,
      code_vendor     TEXT,
      nif             TEXT,
      date_order      TEXT,
      date_reception  TEXT,
      sent_by         TEXT,
      total           REAL
    );

    CREATE TABLE IF NOT EXISTS albaranes_compra (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      delivery_num    TEXT,
      vendor          TEXT,
      code_vendor     TEXT,
      nif             TEXT,
      delivery_for    TEXT,
      date_delivery   TEXT,
      date_sent       TEXT,
      sent_by         TEXT,
      received_by     TEXT,
      base            REAL,
      taxes           REAL,
      total           REAL,
      cost_type       TEXT,
      vendor_type     TEXT
    );

    CREATE TABLE IF NOT EXISTS albaranes_venta (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      invoice_num     TEXT,
      customer        TEXT,
      customer_code   TEXT,
      customer_type   TEXT,
      nif             TEXT,
      contact         TEXT,
      phone           TEXT,
      mail            TEXT,
      address         TEXT,
      cp              TEXT,
      city            TEXT,
      date_delivery   TEXT,
      base            REAL
    );

    CREATE TABLE IF NOT EXISTS facturas_compra (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           TEXT NOT NULL REFERENCES users(id),
      invoice_num       TEXT,
      document_num      TEXT,
      vendor            TEXT,
      code_vendor       TEXT,
      nif               TEXT,
      account_vendor    TEXT,
      date_invoice      TEXT,
      date_accounting   TEXT,
      date_due          TEXT,
      code_payment_type TEXT,
      base              REAL,
      taxes             REAL,
      total             REAL,
      paid              INTEGER,
      validated         INTEGER,
      comment           TEXT
    );

    CREATE TABLE IF NOT EXISTS facturas_venta (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           TEXT NOT NULL REFERENCES users(id),
      invoice_num       TEXT,
      document_num      TEXT,
      customer          TEXT,
      code_customer     TEXT,
      nif               TEXT,
      account_customer  TEXT,
      date_invoice      TEXT,
      date_accounting   TEXT,
      date_due          TEXT,
      code_payment_type TEXT,
      base              REAL,
      taxes             REAL,
      total             REAL,
      paid              INTEGER,
      comment           TEXT
    );

    CREATE TABLE IF NOT EXISTS escandallo_receta (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT NOT NULL REFERENCES users(id),
      nombre       TEXT,
      categoria    TEXT,
      descripcion  TEXT,
      raciones     INTEGER,
      precio_venta REAL,
      ingredientes TEXT,
      merma_pct    REAL,
      notas        TEXT,
      activo       INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS escandallo_lineas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      receta_id       INTEGER NOT NULL,
      user_id         TEXT NOT NULL REFERENCES users(id),
      ingrediente_id  INTEGER,
      nombre_libre    TEXT,
      cantidad        REAL NOT NULL DEFAULT 0,
      unidad          TEXT,
      coste_unitario  REAL,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT,
      urgency    TEXT DEFAULT 'media',
      link       TEXT,
      read       INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS precio_historial (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      nombre     TEXT NOT NULL,
      vendor     TEXT,
      precio     REAL NOT NULL,
      unidad     TEXT,
      fecha      TEXT DEFAULT (date('now')),
      fuente     TEXT DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS merma_registro (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL REFERENCES users(id),
      nombre         TEXT NOT NULL,
      ingrediente_id INTEGER,
      cantidad       REAL,
      unidad         TEXT,
      motivo         TEXT,
      coste_estimado REAL,
      fecha          TEXT DEFAULT (date('now')),
      notas          TEXT
    );

    CREATE TABLE IF NOT EXISTS lineas_albaran_compra (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      albaran_id      INTEGER,
      vendor          TEXT,
      nombre          TEXT,
      cantidad        REAL,
      unidad          TEXT,
      precio_unitario REAL,
      total_linea     REAL,
      fecha           TEXT DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS ventas_produccion (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT NOT NULL REFERENCES users(id),
      receta_id INTEGER,
      nombre    TEXT,
      raciones  INTEGER,
      fecha     TEXT DEFAULT (date('now')),
      notas     TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const hash = bcrypt.hashSync('Marginbites2026+', 10)
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, name)
    VALUES ('pablo-admin', 'pabloperez@visualandgrowth.es', ?, 'Pablo Perez')
  `).run(hash)

  // Auto-seed demo data if DB is empty (new installation or after data loss)
  const ingCount = (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id=?').get('pablo-admin') as any).c
  if (ingCount === 0) {
    seedDemoData(db, 'pablo-admin')
  }
}

function seedDemoData(db: Database.Database, uid: string) {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()
  const dAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }
  const mAgo = (n: number) => { const d = new Date(today); d.setMonth(d.getMonth() - n); return fmt(d) }

  // PROVEEDORES
  const proveedores = [
    { codi:'PROV001', descr:'Mercabarna Express SL', descr_type:'Frutas y Verduras', mail:'pedidos@mercabarnaexpress.com', phone:'+34645966701', nif:'B12345678', city:'Barcelona', cp:'08040' },
    { codi:'PROV002', descr:'Pescados del Atlántico SA', descr_type:'Pescadería', mail:'comercial@pescadosatlantico.es', phone:'+34645966701', nif:'A87654321', city:'A Coruña', cp:'15001' },
    { codi:'PROV003', descr:'Carnes Selectas Martínez', descr_type:'Carnicería', mail:'info@carnesmartinez.com', phone:'+34645966701', nif:'B98765432', city:'Vic', cp:'08500' },
    { codi:'PROV004', descr:'Lácteos Frescos del Pirineo', descr_type:'Lácteos', mail:'ventas@lacteosfrescos.es', phone:'+34645966701', nif:'B11223344', city:'Lleida', cp:'25001' },
    { codi:'PROV005', descr:'Aceites García e Hijos', descr_type:'Aceites y Conservas', mail:'pedidos@aceitesgarcia.com', phone:'+34645966701', nif:'B55667788', city:'Jaén', cp:'23001' },
    { codi:'PROV006', descr:'Harinera del Norte SL', descr_type:'Harinas y Cereales', mail:'info@harineranorte.com', phone:'+34645966701', nif:'B33445566', city:'Bilbao', cp:'48001' },
    { codi:'PROV007', descr:'Bodegas Rioja Premium', descr_type:'Bebidas y Vinos', mail:'export@bodegasrioja.com', phone:'+34645966701', nif:'A22334455', city:'Logroño', cp:'26001' },
    { codi:'PROV008', descr:'Distribuciones Roca Alimentación', descr_type:'Distribuidor General', mail:'pedidos@distrroca.com', phone:'+34645966701', nif:'B77889900', city:'Sabadell', cp:'08201' },
  ]
  const provIds: Record<string, number> = {}
  for (const p of proveedores) {
    const r = db.prepare(`INSERT INTO proveedores (user_id,codi,descr,descr_type,mail,phone,nif,city,cp,defecte,locked,replicated) VALUES (?,?,?,?,?,?,?,?,?,0,0,0)`).run(uid,p.codi,p.descr,p.descr_type,p.mail,p.phone,p.nif,p.city,p.cp)
    provIds[p.codi] = r.lastInsertRowid as number
  }

  // INGREDIENTES
  const ingredientes = [
    { codi:'ING001', descr:'Salmón fresco', type:'Pescado', unit:'kg', cost:15.20 },
    { codi:'ING002', descr:'Merluza fresca', type:'Pescado', unit:'kg', cost:9.80 },
    { codi:'ING003', descr:'Gambas rojas', type:'Marisco', unit:'kg', cost:28.50 },
    { codi:'ING004', descr:'Pulpo cocido', type:'Marisco', unit:'kg', cost:12.40 },
    { codi:'ING005', descr:'Bacalao desalado', type:'Pescado', unit:'kg', cost:11.60 },
    { codi:'ING006', descr:'Pechuga de pollo', type:'Carne', unit:'kg', cost:6.20 },
    { codi:'ING007', descr:'Solomillo de ternera', type:'Carne', unit:'kg', cost:32.00 },
    { codi:'ING008', descr:'Costilla de cerdo', type:'Carne', unit:'kg', cost:5.80 },
    { codi:'ING009', descr:'Muslo de pato confitado', type:'Carne', unit:'ud', cost:4.50 },
    { codi:'ING010', descr:'Foie gras mi-cuit', type:'Charcutería', unit:'kg', cost:68.00 },
    { codi:'ING011', descr:'Tomate rama', type:'Verdura', unit:'kg', cost:1.80 },
    { codi:'ING012', descr:'Pimiento rojo', type:'Verdura', unit:'kg', cost:1.40 },
    { codi:'ING013', descr:'Pimiento verde', type:'Verdura', unit:'kg', cost:1.20 },
    { codi:'ING014', descr:'Cebolla blanca', type:'Verdura', unit:'kg', cost:0.60 },
    { codi:'ING015', descr:'Ajo', type:'Verdura', unit:'kg', cost:3.20 },
    { codi:'ING016', descr:'Patata agria', type:'Verdura', unit:'kg', cost:0.55 },
    { codi:'ING017', descr:'Espárrago verde', type:'Verdura', unit:'kg', cost:4.80 },
    { codi:'ING018', descr:'Berenjena', type:'Verdura', unit:'kg', cost:1.10 },
    { codi:'ING019', descr:'Calabacín', type:'Verdura', unit:'kg', cost:0.90 },
    { codi:'ING020', descr:'Champiñón laminado', type:'Hongo', unit:'kg', cost:2.40 },
    { codi:'ING021', descr:'Trufa negra rallada', type:'Hongo', unit:'g', cost:0.85 },
    { codi:'ING022', descr:'Nata líquida 35%', type:'Lácteo', unit:'l', cost:2.30 },
    { codi:'ING023', descr:'Mantequilla sin sal', type:'Lácteo', unit:'kg', cost:8.40 },
    { codi:'ING024', descr:'Queso parmesano', type:'Lácteo', unit:'kg', cost:18.50 },
    { codi:'ING025', descr:'Queso manchego curado', type:'Lácteo', unit:'kg', cost:14.20 },
    { codi:'ING026', descr:'Huevos camperos L', type:'Lácteo', unit:'ud', cost:0.28 },
    { codi:'ING027', descr:'Aceite de oliva virgen extra', type:'Aceite', unit:'l', cost:6.20 },
    { codi:'ING028', descr:'Harina de trigo T55', type:'Harina', unit:'kg', cost:0.87 },
    { codi:'ING029', descr:'Arroz bomba', type:'Cereal', unit:'kg', cost:2.10 },
    { codi:'ING030', descr:'Pasta fresca tagliatelle', type:'Pasta', unit:'kg', cost:3.40 },
    { codi:'ING031', descr:'Caldo de pollo', type:'Caldo', unit:'l', cost:1.20 },
    { codi:'ING032', descr:'Vino blanco Albariño', type:'Vino', unit:'l', cost:4.80 },
    { codi:'ING033', descr:'Azúcar blanco', type:'Azúcar', unit:'kg', cost:0.95 },
    { codi:'ING034', descr:'Sal marina fina', type:'Condimento', unit:'kg', cost:0.40 },
    { codi:'ING035', descr:'Pimienta negra molida', type:'Especia', unit:'kg', cost:12.00 },
    { codi:'ING036', descr:'Azafrán', type:'Especia', unit:'g', cost:0.28 },
    { codi:'ING037', descr:'Pimentón ahumado', type:'Especia', unit:'kg', cost:8.50 },
    { codi:'ING038', descr:'Fresas frescas', type:'Fruta', unit:'kg', cost:5.00 },
    { codi:'ING039', descr:'Limón', type:'Fruta', unit:'kg', cost:1.40 },
    { codi:'ING040', descr:'Chocolate negro 70%', type:'Repostería', unit:'kg', cost:11.20 },
  ]
  for (const i of ingredientes) {
    db.prepare(`INSERT INTO ingredientes (user_id,codi,descr,type,unit,cost,has_data) VALUES (?,?,?,?,?,?,1)`).run(uid,i.codi,i.descr,i.type,i.unit,i.cost)
  }

  // HERRAMIENTAS
  for (const h of [
    { codi:'HER001', descr:'Termómetro digital cocina', type:'Utensilio', unit:'ud', cost:45.00 },
    { codi:'HER002', descr:'Sartén antiadherente 28cm', type:'Utensilio', unit:'ud', cost:38.00 },
    { codi:'HER003', descr:'Robot de cocina Thermomix', type:'Maquinaria', unit:'ud', cost:1200.00 },
    { codi:'HER004', descr:'Batidora de brazo', type:'Maquinaria', unit:'ud', cost:180.00 },
    { codi:'HER005', descr:'Tabla de corte HACCP verde', type:'Utensilio', unit:'ud', cost:22.00 },
  ]) {
    db.prepare(`INSERT INTO herramientas (user_id,codi,descr,type,unit,cost,has_data) VALUES (?,?,?,?,?,?,1)`).run(uid,h.codi,h.descr,h.type,h.unit,h.cost)
  }

  // PEDIDOS
  for (const p of [
    { num:'PED-0412', vendor:'Mercabarna Express SL', date_order:dAgo(1), date_reception:dAgo(0), total:342.80 },
    { num:'PED-0411', vendor:'Pescados del Atlántico SA', date_order:dAgo(2), date_reception:dAgo(1), total:687.40 },
    { num:'PED-0410', vendor:'Carnes Selectas Martínez', date_order:dAgo(3), date_reception:dAgo(2), total:524.60 },
    { num:'PED-0409', vendor:'Lácteos Frescos del Pirineo', date_order:dAgo(5), date_reception:dAgo(4), total:198.30 },
    { num:'PED-0408', vendor:'Aceites García e Hijos', date_order:dAgo(6), date_reception:dAgo(5), total:413.00 },
    { num:'PED-0407', vendor:'Mercabarna Express SL', date_order:dAgo(8), date_reception:dAgo(7), total:289.50 },
    { num:'PED-0406', vendor:'Harinera del Norte SL', date_order:dAgo(9), date_reception:dAgo(8), total:156.75 },
    { num:'PED-0405', vendor:'Bodegas Rioja Premium', date_order:dAgo(10), date_reception:dAgo(9), total:892.00 },
    { num:'PED-0322', vendor:'Mercabarna Express SL', date_order:mAgo(1), date_reception:mAgo(1), total:318.40 },
    { num:'PED-0321', vendor:'Carnes Selectas Martínez', date_order:mAgo(1), date_reception:mAgo(1), total:612.80 },
    { num:'PED-0320', vendor:'Pescados del Atlántico SA', date_order:mAgo(1), date_reception:mAgo(1), total:523.10 },
  ]) {
    db.prepare(`INSERT INTO pedidos_compra (user_id,num_order,vendor,date_order,date_reception,total) VALUES (?,?,?,?,?,?)`).run(uid,p.num,p.vendor,p.date_order,p.date_reception,p.total)
  }

  // LISTA PEDIDOS
  for (const lp of [
    { descr:'Pedido semanal verduras', year:today.getFullYear(), month:today.getMonth()+1, pending_send:0, pending_receive:0 },
    { descr:'Pedido pescado lunes', year:today.getFullYear(), month:today.getMonth()+1, pending_send:0, pending_receive:1 },
    { descr:'Pedido carnes semana', year:today.getFullYear(), month:today.getMonth()+1, pending_send:1, pending_receive:0 },
    { descr:'Pedido lácteos quincenal', year:today.getFullYear(), month:today.getMonth()+1, pending_send:1, pending_receive:1 },
  ]) {
    db.prepare(`INSERT INTO lista_pedidos (user_id,descr,year,month,pending_send,pending_receive,locked,replicated) VALUES (?,?,?,?,?,?,0,0)`).run(uid,lp.descr,lp.year,lp.month,lp.pending_send,lp.pending_receive)
  }

  // FACTURAS COMPRA
  for (const f of [
    { num:'FAC-0089', vendor:'Mercabarna Express SL', date_invoice:dAgo(7), date_due:dAgo(-7), base:522.56, taxes:109.74, total:632.30, paid:0 },
    { num:'FAC-0088', vendor:'Pescados del Atlántico SA', date_invoice:dAgo(10), date_due:dAgo(-5), base:993.45, taxes:208.62, total:1202.07, paid:0 },
    { num:'FAC-0087', vendor:'Carnes Selectas Martínez', date_invoice:dAgo(14), date_due:dAgo(1), base:866.45, taxes:181.95, total:1048.40, paid:0 },
    { num:'FAC-0086', vendor:'Bodegas Rioja Premium', date_invoice:dAgo(15), date_due:dAgo(15), base:737.19, taxes:154.81, total:892.00, paid:1 },
    { num:'FAC-0085', vendor:'Aceites García e Hijos', date_invoice:dAgo(20), date_due:dAgo(5), base:341.32, taxes:71.68, total:413.00, paid:0 },
    { num:'FAC-0082', vendor:'Mercabarna Express SL', date_invoice:mAgo(1), date_due:dAgo(2), base:263.14, taxes:55.26, total:318.40, paid:0 },
    { num:'FAC-0081', vendor:'Distribuciones Roca Alimentación', date_invoice:mAgo(1), date_due:dAgo(3), base:560.66, taxes:117.74, total:678.40, paid:0 },
  ]) {
    db.prepare(`INSERT INTO facturas_compra (user_id,invoice_num,vendor,date_invoice,date_due,base,taxes,total,paid,validated) VALUES (?,?,?,?,?,?,?,?,?,1)`).run(uid,f.num,f.vendor,f.date_invoice,f.date_due,f.base,f.taxes,f.total,f.paid)
  }

  // MERMA
  for (const m of [
    { nombre:'Salmón fresco', cantidad:1.2, unidad:'kg', motivo:'caducidad', coste_estimado:18.24, fecha:dAgo(2) },
    { nombre:'Tomate rama', cantidad:3.5, unidad:'kg', motivo:'caducidad', coste_estimado:6.30, fecha:dAgo(4) },
    { nombre:'Nata líquida 35%', cantidad:2, unidad:'l', motivo:'sobreproducción', coste_estimado:4.60, fecha:dAgo(5) },
    { nombre:'Pan brioche', cantidad:8, unidad:'ud', motivo:'caducidad', coste_estimado:9.60, fecha:dAgo(6) },
    { nombre:'Gambas rojas', cantidad:0.4, unidad:'kg', motivo:'caducidad', coste_estimado:11.40, fecha:dAgo(3) },
    { nombre:'Merluza fresca', cantidad:0.6, unidad:'kg', motivo:'sobreproducción', coste_estimado:5.88, fecha:dAgo(1) },
    { nombre:'Fresas frescas', cantidad:0.8, unidad:'kg', motivo:'caducidad', coste_estimado:4.00, fecha:dAgo(1) },
  ]) {
    db.prepare(`INSERT INTO merma_registro (user_id,nombre,cantidad,unidad,motivo,coste_estimado,fecha) VALUES (?,?,?,?,?,?,?)`).run(uid,m.nombre,m.cantidad,m.unidad,m.motivo,m.coste_estimado,m.fecha)
  }

  // PRECIO HISTORIAL
  for (const p of [
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precio:4.20, unidad:'l', fecha:mAgo(3) },
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precio:5.60, unidad:'l', fecha:mAgo(1) },
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precio:6.20, unidad:'l', fecha:dAgo(10) },
    { nombre:'Salmón fresco', vendor:'Pescados del Atlántico SA', precio:11.80, unidad:'kg', fecha:mAgo(3) },
    { nombre:'Salmón fresco', vendor:'Pescados del Atlántico SA', precio:14.50, unidad:'kg', fecha:mAgo(1) },
    { nombre:'Salmón fresco', vendor:'Pescados del Atlántico SA', precio:15.20, unidad:'kg', fecha:dAgo(5) },
    { nombre:'Gambas rojas', vendor:'Pescados del Atlántico SA', precio:24.00, unidad:'kg', fecha:mAgo(2) },
    { nombre:'Gambas rojas', vendor:'Pescados del Atlántico SA', precio:28.50, unidad:'kg', fecha:dAgo(8) },
  ]) {
    db.prepare(`INSERT INTO precio_historial (user_id,nombre,vendor,precio,unidad,fecha,fuente) VALUES (?,?,?,?,?,?,'albaran')`).run(uid,p.nombre,p.vendor,p.precio,p.unidad,p.fecha)
  }

  // ESCANDALLO RECETAS
  const recetas = [
    { nombre:'Salmón a la plancha con verduras', categoria:'Segundos', raciones:1, precio_venta:22.00, merma_pct:8, lineas:[
      { nombre_libre:'Salmón fresco', cantidad:0.18, unidad:'kg', coste_unitario:15.20 },
      { nombre_libre:'Aceite de oliva virgen extra', cantidad:0.02, unidad:'l', coste_unitario:6.20 },
      { nombre_libre:'Espárrago verde', cantidad:0.06, unidad:'kg', coste_unitario:4.80 },
    ]},
    { nombre:'Arroz negro con gambas', categoria:'Arroces', raciones:1, precio_venta:24.00, merma_pct:10, lineas:[
      { nombre_libre:'Arroz bomba', cantidad:0.10, unidad:'kg', coste_unitario:2.10 },
      { nombre_libre:'Gambas rojas', cantidad:0.12, unidad:'kg', coste_unitario:28.50 },
      { nombre_libre:'Caldo de pollo', cantidad:0.25, unidad:'l', coste_unitario:1.20 },
    ]},
    { nombre:'Solomillo al foie', categoria:'Segundos', raciones:1, precio_venta:38.00, merma_pct:8, lineas:[
      { nombre_libre:'Solomillo de ternera', cantidad:0.22, unidad:'kg', coste_unitario:32.00 },
      { nombre_libre:'Foie gras mi-cuit', cantidad:0.04, unidad:'kg', coste_unitario:68.00 },
      { nombre_libre:'Mantequilla sin sal', cantidad:0.02, unidad:'kg', coste_unitario:8.40 },
    ]},
  ]
  for (const r of recetas) {
    const res = db.prepare(`INSERT INTO escandallo_receta (user_id,nombre,categoria,raciones,precio_venta,merma_pct,activo) VALUES (?,?,?,?,?,?,1)`).run(uid,r.nombre,r.categoria,r.raciones,r.precio_venta,r.merma_pct)
    for (const l of r.lineas) {
      db.prepare(`INSERT INTO escandallo_lineas (receta_id,user_id,nombre_libre,cantidad,unidad,coste_unitario) VALUES (?,?,?,?,?,?)`).run(res.lastInsertRowid,uid,l.nombre_libre,l.cantidad,l.unidad,l.coste_unitario)
    }
  }

  // ALBARANES COMPRA
  for (const a of [
    { delivery_num:'ALB-0412', vendor:'Mercabarna Express SL', date_delivery:dAgo(1), base:283.30, taxes:59.49, total:342.80 },
    { delivery_num:'ALB-0411', vendor:'Pescados del Atlántico SA', date_delivery:dAgo(1), base:568.26, taxes:119.13, total:687.40 },
    { delivery_num:'ALB-0410', vendor:'Carnes Selectas Martínez', date_delivery:dAgo(2), base:433.55, taxes:91.05, total:524.60 },
  ]) {
    db.prepare(`INSERT INTO albaranes_compra (user_id,delivery_num,vendor,date_delivery,base,taxes,total) VALUES (?,?,?,?,?,?,?)`).run(uid,a.delivery_num,a.vendor,a.date_delivery,a.base,a.taxes,a.total)
  }
}

function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(DB_PATH)
    initSchema(global._db)
  }
  return global._db
}

const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const instance = getDb()
    const val = (instance as any)[prop]
    return typeof val === 'function' ? val.bind(instance) : val
  },
})

export default db

export type User = {
  id: string
  email: string
  name: string | null
  google_id: string | null
  avatar: string | null
  created_at: string
}
