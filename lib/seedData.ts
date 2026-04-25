import Database from 'better-sqlite3'

export function seedDemoData(db: Database.Database, uid: string) {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()
  const dAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }
  const mAgo = (n: number, day = 15) => { const d = new Date(today); d.setMonth(d.getMonth() - n); d.setDate(day); return fmt(d) }

  // Clear existing data for this user
  const tables = ['ingredientes','herramientas','proveedores','proveedores_detalle','lista_pedidos',
    'pedidos_compra','albaranes_compra','facturas_compra','albaranes_venta','facturas_venta',
    'escandallo_receta','escandallo_lineas','precio_historial','merma_registro',
    'lineas_albaran_compra','ventas_produccion']
  for (const t of tables) db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid)

  // ── PROVEEDORES ───────────────────────────────────────────────────────────
  const proveedores = [
    { codi:'PROV001', descr:'Mercabarna Express SL',          descr_type:'Frutas y Verduras',    mail:'pedidos@mercabarnaexpress.com',   phone:'+34645966701', nif:'B12345678', city:'Barcelona',   cp:'08040', contact:'Josep Puig' },
    { codi:'PROV002', descr:'Pescados del Atlántico SA',      descr_type:'Pescadería',            mail:'comercial@pescadosatlantico.es',  phone:'+34645966701', nif:'A87654321', city:'A Coruña',    cp:'15001', contact:'María Fernández' },
    { codi:'PROV003', descr:'Carnes Selectas Martínez',       descr_type:'Carnicería',            mail:'info@carnesmartinez.com',         phone:'+34645966701', nif:'B98765432', city:'Vic',         cp:'08500', contact:'Jordi Martínez' },
    { codi:'PROV004', descr:'Lácteos Frescos del Pirineo',    descr_type:'Lácteos',               mail:'ventas@lacteosfrescos.es',        phone:'+34645966701', nif:'B11223344', city:'Lleida',      cp:'25001', contact:'Anna Solé' },
    { codi:'PROV005', descr:'Aceites García e Hijos',         descr_type:'Aceites y Conservas',   mail:'pedidos@aceitesgarcia.com',       phone:'+34645966701', nif:'B55667788', city:'Jaén',        cp:'23001', contact:'Antonio García' },
    { codi:'PROV006', descr:'Harinera del Norte SL',          descr_type:'Harinas y Cereales',    mail:'info@harineranorte.com',          phone:'+34645966701', nif:'B33445566', city:'Bilbao',      cp:'48001', contact:'Iker Etxeberria' },
    { codi:'PROV007', descr:'Bodegas Rioja Premium',          descr_type:'Bebidas y Vinos',       mail:'export@bodegasrioja.com',         phone:'+34645966701', nif:'A22334455', city:'Logroño',     cp:'26001', contact:'Carlos Moya' },
    { codi:'PROV008', descr:'Distribuciones Roca Alimentación', descr_type:'Distribuidor General',mail:'pedidos@distrroca.com',           phone:'+34645966701', nif:'B77889900', city:'Sabadell',    cp:'08201', contact:'Pere Roca' },
    { codi:'PROV009', descr:'Verduras del Mediterráneo SL',   descr_type:'Verduras',              mail:'info@verduramediterraneo.es',     phone:'+34645966701', nif:'B44556677', city:'Valencia',    cp:'46001', contact:'Pilar Navarro' },
    { codi:'PROV010', descr:'Mariscos Costa Brava SL',        descr_type:'Marisco',               mail:'pedidos@mariscoscostabrava.com',  phone:'+34645966701', nif:'B99001122', city:'Girona',      cp:'17001', contact:'Miquel Puigdomènech' },
    { codi:'PROV011', descr:'Charcutería Ibérica Extremeña',  descr_type:'Charcutería',           mail:'ventas@ibericaextremena.es',      phone:'+34645966701', nif:'B33221100', city:'Badajoz',     cp:'06001', contact:'Manolo Bravo' },
    { codi:'PROV012', descr:'Pastelería Industrial Balear',   descr_type:'Repostería y Bollería', mail:'pedidos@pasteleriabalear.com',    phone:'+34645966701', nif:'B55443322', city:'Palma',       cp:'07001', contact:'Catalina Ferrer' },
    { codi:'PROV013', descr:'Cafés y Especias del Mundo',     descr_type:'Especias y Café',       mail:'info@cafesyespecias.com',         phone:'+34645966701', nif:'B66778899', city:'Madrid',      cp:'28001', contact:'Roberto Santos' },
    { codi:'PROV014', descr:'Congelados Premium Norte SA',    descr_type:'Congelados',            mail:'ventas@congeladosnorte.es',       phone:'+34645966701', nif:'A11223344', city:'Santander',   cp:'39001', contact:'Laura González' },
    { codi:'PROV015', descr:'Ecológicos del Valle SL',        descr_type:'Productos Ecológicos',  mail:'pedidos@ecologicosvalle.es',      phone:'+34645966701', nif:'B88990011', city:'Granada',     cp:'18001', contact:'Isabel Ruiz' },
  ]
  const provIds: Record<string, number> = {}
  for (const p of proveedores) {
    const r = db.prepare(`INSERT INTO proveedores (user_id,codi,descr,descr_type,mail,phone,nif,city,cp,contact,defecte,locked,replicated) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,0)`)
      .run(uid,p.codi,p.descr,p.descr_type,p.mail,p.phone,p.nif,p.city,p.cp,p.contact)
    provIds[p.codi] = r.lastInsertRowid as number
  }

  // ── INGREDIENTES ──────────────────────────────────────────────────────────
  const ingredientes = [
    // Pescados
    { codi:'ING001', descr:'Salmón fresco (lomo)',         type:'Pescado',      unit:'kg',  cost:15.20 },
    { codi:'ING002', descr:'Merluza fresca (filete)',      type:'Pescado',      unit:'kg',  cost:9.80  },
    { codi:'ING003', descr:'Lubina fresca entera',         type:'Pescado',      unit:'kg',  cost:12.60 },
    { codi:'ING004', descr:'Bacalao desalado',             type:'Pescado',      unit:'kg',  cost:11.60 },
    { codi:'ING005', descr:'Atún rojo (sashimi)',          type:'Pescado',      unit:'kg',  cost:42.00 },
    { codi:'ING006', descr:'Dorada fresca entera',         type:'Pescado',      unit:'kg',  cost:10.40 },
    { codi:'ING007', descr:'Rodaballo fresco',             type:'Pescado',      unit:'kg',  cost:22.00 },
    // Mariscos
    { codi:'ING008', descr:'Gambas rojas (16/20)',         type:'Marisco',      unit:'kg',  cost:28.50 },
    { codi:'ING009', descr:'Pulpo cocido (tentáculos)',    type:'Marisco',      unit:'kg',  cost:12.40 },
    { codi:'ING010', descr:'Almejas frescas',              type:'Marisco',      unit:'kg',  cost:14.80 },
    { codi:'ING011', descr:'Langostinos tigre',            type:'Marisco',      unit:'kg',  cost:32.00 },
    { codi:'ING012', descr:'Mejillones frescos',           type:'Marisco',      unit:'kg',  cost:3.20  },
    { codi:'ING013', descr:'Vieiras (concha)',             type:'Marisco',      unit:'ud',  cost:2.80  },
    { codi:'ING014', descr:'Navaja fresca',                type:'Marisco',      unit:'kg',  cost:18.50 },
    // Carnes
    { codi:'ING015', descr:'Pechuga de pollo (filetes)',   type:'Carne',        unit:'kg',  cost:6.20  },
    { codi:'ING016', descr:'Muslo de pollo (deshuesado)',  type:'Carne',        unit:'kg',  cost:4.80  },
    { codi:'ING017', descr:'Solomillo de ternera',         type:'Carne',        unit:'kg',  cost:32.00 },
    { codi:'ING018', descr:'Chuletón de buey madurado',   type:'Carne',        unit:'kg',  cost:58.00 },
    { codi:'ING019', descr:'Costilla de cerdo ibérico',   type:'Carne',        unit:'kg',  cost:8.60  },
    { codi:'ING020', descr:'Carrillera de cerdo',          type:'Carne',        unit:'kg',  cost:7.40  },
    { codi:'ING021', descr:'Muslo de pato confitado',      type:'Carne',        unit:'ud',  cost:4.50  },
    { codi:'ING022', descr:'Cordero lechal (pierna)',      type:'Carne',        unit:'kg',  cost:16.80 },
    { codi:'ING023', descr:'Ternera picada (80/20)',       type:'Carne',        unit:'kg',  cost:9.20  },
    // Charcutería y embutidos
    { codi:'ING024', descr:'Foie gras mi-cuit',            type:'Charcutería',  unit:'kg',  cost:68.00 },
    { codi:'ING025', descr:'Jamón ibérico de bellota',     type:'Charcutería',  unit:'kg',  cost:95.00 },
    { codi:'ING026', descr:'Chorizo ibérico curado',       type:'Charcutería',  unit:'kg',  cost:22.00 },
    { codi:'ING027', descr:'Panceta ahumada (lonchas)',    type:'Charcutería',  unit:'kg',  cost:11.50 },
    // Verduras y hortalizas
    { codi:'ING028', descr:'Tomate rama madurado',         type:'Verdura',      unit:'kg',  cost:1.80  },
    { codi:'ING029', descr:'Tomate cherry mix',            type:'Verdura',      unit:'kg',  cost:3.60  },
    { codi:'ING030', descr:'Pimiento rojo extra',          type:'Verdura',      unit:'kg',  cost:1.40  },
    { codi:'ING031', descr:'Pimiento verde italiano',      type:'Verdura',      unit:'kg',  cost:1.20  },
    { codi:'ING032', descr:'Cebolla blanca grande',        type:'Verdura',      unit:'kg',  cost:0.60  },
    { codi:'ING033', descr:'Cebolla morada',               type:'Verdura',      unit:'kg',  cost:0.80  },
    { codi:'ING034', descr:'Ajo morado fresco',            type:'Verdura',      unit:'kg',  cost:3.20  },
    { codi:'ING035', descr:'Patata agria (Monalisa)',      type:'Verdura',      unit:'kg',  cost:0.55  },
    { codi:'ING036', descr:'Patata para freír',            type:'Verdura',      unit:'kg',  cost:0.48  },
    { codi:'ING037', descr:'Espárrago verde (calibre 16)', type:'Verdura',      unit:'kg',  cost:4.80  },
    { codi:'ING038', descr:'Espinaca baby (bolsa)',        type:'Verdura',      unit:'kg',  cost:5.20  },
    { codi:'ING039', descr:'Berenjena (extra)',            type:'Verdura',      unit:'kg',  cost:1.10  },
    { codi:'ING040', descr:'Calabacín verde',              type:'Verdura',      unit:'kg',  cost:0.90  },
    { codi:'ING041', descr:'Zanahoria (pelada)',           type:'Verdura',      unit:'kg',  cost:0.75  },
    { codi:'ING042', descr:'Apio (ramas)',                 type:'Verdura',      unit:'kg',  cost:1.20  },
    { codi:'ING043', descr:'Puerro fresco',                type:'Verdura',      unit:'kg',  cost:1.60  },
    { codi:'ING044', descr:'Alcachofa fresca',             type:'Verdura',      unit:'ud',  cost:0.80  },
    { codi:'ING045', descr:'Remolacha cocida (vac.)',      type:'Verdura',      unit:'kg',  cost:2.40  },
    // Hongos
    { codi:'ING046', descr:'Champiñón laminado',           type:'Hongo',        unit:'kg',  cost:2.40  },
    { codi:'ING047', descr:'Seta shiitake fresca',         type:'Hongo',        unit:'kg',  cost:12.00 },
    { codi:'ING048', descr:'Boletus edulis (congelado)',   type:'Hongo',        unit:'kg',  cost:28.00 },
    { codi:'ING049', descr:'Trufa negra rallada (tarro)',  type:'Hongo',        unit:'g',   cost:0.85  },
    { codi:'ING050', descr:'Rúcula fresca (bolsa)',        type:'Hongo',        unit:'kg',  cost:6.80  },
    // Lácteos
    { codi:'ING051', descr:'Nata líquida 35% MG',         type:'Lácteo',       unit:'l',   cost:2.30  },
    { codi:'ING052', descr:'Mantequilla sin sal (placa)',  type:'Lácteo',       unit:'kg',  cost:8.40  },
    { codi:'ING053', descr:'Queso parmesano (cuña)',       type:'Lácteo',       unit:'kg',  cost:18.50 },
    { codi:'ING054', descr:'Queso manchego curado',        type:'Lácteo',       unit:'kg',  cost:14.20 },
    { codi:'ING055', descr:'Queso brie francés',           type:'Lácteo',       unit:'kg',  cost:16.80 },
    { codi:'ING056', descr:'Queso de cabra rulo',          type:'Lácteo',       unit:'ud',  cost:3.20  },
    { codi:'ING057', descr:'Huevos camperos L (docena)',   type:'Lácteo',       unit:'ud',  cost:0.28  },
    { codi:'ING058', descr:'Leche entera (brick)',         type:'Lácteo',       unit:'l',   cost:0.85  },
    { codi:'ING059', descr:'Yogur griego (bote 1kg)',      type:'Lácteo',       unit:'kg',  cost:3.40  },
    // Aceites y conservas
    { codi:'ING060', descr:'Aceite de oliva virgen extra', type:'Aceite',       unit:'l',   cost:6.20  },
    { codi:'ING061', descr:'Aceite de girasol refinado',   type:'Aceite',       unit:'l',   cost:1.40  },
    { codi:'ING062', descr:'Vinagre de Módena IGP',        type:'Conserva',     unit:'l',   cost:8.50  },
    { codi:'ING063', descr:'Tomate triturado (lata 3kg)',  type:'Conserva',     unit:'kg',  cost:1.60  },
    { codi:'ING064', descr:'Anchoas en aceite (lata)',     type:'Conserva',     unit:'ud',  cost:4.80  },
    // Harinas y cereales
    { codi:'ING065', descr:'Harina de trigo T55',          type:'Harina',       unit:'kg',  cost:0.87  },
    { codi:'ING066', descr:'Harina de fuerza W360',        type:'Harina',       unit:'kg',  cost:1.20  },
    { codi:'ING067', descr:'Arroz bomba (DO Valencia)',    type:'Cereal',       unit:'kg',  cost:2.10  },
    { codi:'ING068', descr:'Pasta fresca tagliatelle',     type:'Pasta',        unit:'kg',  cost:3.40  },
    { codi:'ING069', descr:'Pan de molde brioche',         type:'Panadería',    unit:'ud',  cost:1.20  },
    { codi:'ING070', descr:'Pan de cristal (barra)',       type:'Panadería',    unit:'ud',  cost:1.80  },
    // Caldos y fondos
    { codi:'ING071', descr:'Caldo de pollo (envase 1L)',   type:'Caldo',        unit:'l',   cost:1.20  },
    { codi:'ING072', descr:'Fondo oscuro de ternera',      type:'Caldo',        unit:'l',   cost:3.60  },
    { codi:'ING073', descr:'Fumet de pescado',             type:'Caldo',        unit:'l',   cost:2.40  },
    // Bebidas y alcoholes cocina
    { codi:'ING074', descr:'Vino blanco Albariño (cocina)',type:'Vino',         unit:'l',   cost:4.80  },
    { codi:'ING075', descr:'Vino tinto Rioja (cocina)',    type:'Vino',         unit:'l',   cost:3.60  },
    { codi:'ING076', descr:'Brandy de Jerez',              type:'Licor',        unit:'l',   cost:12.00 },
    // Azúcares y repostería
    { codi:'ING077', descr:'Azúcar blanco refinado',       type:'Azúcar',       unit:'kg',  cost:0.95  },
    { codi:'ING078', descr:'Azúcar moreno de caña',        type:'Azúcar',       unit:'kg',  cost:1.40  },
    { codi:'ING079', descr:'Chocolate negro 70% (pastilla)',type:'Repostería',  unit:'kg',  cost:11.20 },
    { codi:'ING080', descr:'Chocolate blanco (pastilla)',  type:'Repostería',   unit:'kg',  cost:9.80  },
    { codi:'ING081', descr:'Fresas frescas (bandeja 500g)',type:'Fruta',        unit:'kg',  cost:5.00  },
    { codi:'ING082', descr:'Frambuesa fresca',             type:'Fruta',        unit:'kg',  cost:18.00 },
    { codi:'ING083', descr:'Mango (extra)',                type:'Fruta',        unit:'kg',  cost:3.80  },
    { codi:'ING084', descr:'Limón (malla 5kg)',            type:'Fruta',        unit:'kg',  cost:1.40  },
    { codi:'ING085', descr:'Naranja zumo (clase A)',       type:'Fruta',        unit:'kg',  cost:0.80  },
    // Especias y condimentos
    { codi:'ING086', descr:'Sal marina fina (saco 25kg)', type:'Condimento',   unit:'kg',  cost:0.40  },
    { codi:'ING087', descr:'Pimienta negra molida',        type:'Especia',      unit:'kg',  cost:12.00 },
    { codi:'ING088', descr:'Pimentón ahumado La Vera',     type:'Especia',      unit:'kg',  cost:8.50  },
    { codi:'ING089', descr:'Azafrán (hebras, 1g)',         type:'Especia',      unit:'g',   cost:0.28  },
    { codi:'ING090', descr:'Romero fresco (manojo)',       type:'Hierba',       unit:'ud',  cost:0.60  },
    { codi:'ING091', descr:'Tomillo fresco (manojo)',      type:'Hierba',       unit:'ud',  cost:0.55  },
    { codi:'ING092', descr:'Albahaca fresca (maceta)',     type:'Hierba',       unit:'ud',  cost:1.80  },
  ]
  for (const i of ingredientes) {
    db.prepare(`INSERT INTO ingredientes (user_id,codi,descr,type,unit,cost,has_data) VALUES (?,?,?,?,?,?,1)`)
      .run(uid,i.codi,i.descr,i.type,i.unit,i.cost)
  }

  // Assign proveedor_id to specific ingredients (leaving some unassigned on purpose)
  const ingProvMap: Record<string, string> = {
    // Pescados → Pescados del Atlántico SA
    'ING001': 'PROV002', 'ING002': 'PROV002', 'ING003': 'PROV002',
    'ING004': 'PROV002', 'ING006': 'PROV002', 'ING007': 'PROV002',
    // Mariscos → Mariscos Costa Brava SL
    'ING008': 'PROV010', 'ING009': 'PROV010', 'ING010': 'PROV010',
    'ING011': 'PROV010', 'ING012': 'PROV010', 'ING013': 'PROV010',
    // ING005 (Atún rojo) y ING014 (Navaja) sin proveedor — los piden ocasionalmente
    // Carnes → Carnes Selectas Martínez
    'ING015': 'PROV003', 'ING016': 'PROV003', 'ING017': 'PROV003',
    'ING018': 'PROV003', 'ING019': 'PROV003', 'ING020': 'PROV003',
    'ING022': 'PROV003', 'ING023': 'PROV003',
    // ING021 (Muslo de pato) sin proveedor — producto especial
    // Charcutería → Charcutería Ibérica Extremeña
    'ING024': 'PROV011', 'ING025': 'PROV011', 'ING026': 'PROV011', 'ING027': 'PROV011',
    // Verduras → Mercabarna Express SL
    'ING028': 'PROV001', 'ING029': 'PROV001', 'ING030': 'PROV001',
    'ING031': 'PROV001', 'ING032': 'PROV001', 'ING033': 'PROV001',
    'ING034': 'PROV001', 'ING035': 'PROV001', 'ING036': 'PROV001',
    'ING037': 'PROV001', 'ING038': 'PROV001',
    // ING039-ING045 (berenjena, calabacín, zanahoria, apio, puerro, alcachofa, remolacha) → Verduras del Mediterráneo
    'ING039': 'PROV009', 'ING040': 'PROV009', 'ING041': 'PROV009',
    'ING042': 'PROV009', 'ING043': 'PROV009', 'ING044': 'PROV009', 'ING045': 'PROV009',
    // Hongos — sin proveedor (ING046-ING050 se dejan sin asignar)
    // Lácteos → Lácteos Frescos del Pirineo
    'ING051': 'PROV004', 'ING052': 'PROV004', 'ING053': 'PROV004',
    'ING054': 'PROV004', 'ING057': 'PROV004', 'ING058': 'PROV004', 'ING059': 'PROV004',
    // ING055 (Brie) e ING056 (Cabra) sin proveedor — se compran según temporada
    // Aceites → Aceites García e Hijos
    'ING060': 'PROV005', 'ING061': 'PROV005',
    // Conservas → Aceites García e Hijos
    'ING062': 'PROV005', 'ING063': 'PROV005',
    // ING064 (Anchoas) sin proveedor
    // Harinas → Harinera del Norte SL
    'ING065': 'PROV006', 'ING066': 'PROV006',
    // Cereales y pasta → Harinera del Norte SL
    'ING067': 'PROV006', 'ING068': 'PROV006',
    // Pan (ING069, ING070) sin proveedor — panadería local
    // Caldos (ING071-ING073) sin proveedor — elaboración propia
    // Vinos → Bodegas Rioja Premium
    'ING074': 'PROV007', 'ING075': 'PROV007',
    // ING076 (Brandy) sin proveedor
    // Azúcares (ING077, ING078) sin proveedor
    // Repostería → Pastelería Industrial Balear
    'ING079': 'PROV012', 'ING080': 'PROV012',
    // Frutas → Mercabarna Express SL
    'ING081': 'PROV001', 'ING082': 'PROV001', 'ING083': 'PROV001',
    'ING084': 'PROV001', 'ING085': 'PROV001',
    // Especias → Cafés y Especias del Mundo
    'ING087': 'PROV013', 'ING088': 'PROV013', 'ING089': 'PROV013',
    // ING086 (Sal) sin proveedor — se compra a granel
    // Hierbas (ING090-ING092) sin proveedor — proveedor local pendiente de confirmar
  }
  for (const [codi, provCodi] of Object.entries(ingProvMap)) {
    const provId = provIds[provCodi]
    const provDescr = proveedores.find(p => p.codi === provCodi)?.descr || ''
    if (provId) {
      db.prepare(`UPDATE ingredientes SET proveedor_id=?, proveedor_nombre=? WHERE user_id=? AND codi=?`)
        .run(provId, provDescr, uid, codi)
    }
  }

  // ── HERRAMIENTAS ──────────────────────────────────────────────────────────
  const herramientas = [
    { codi:'HER001', descr:'Thermomix TM6',                      type:'Maquinaria',  unit:'ud',  cost:1499.00 },
    { codi:'HER002', descr:'Horno mixto Rational iCombi Pro 6-1', type:'Maquinaria', unit:'ud',  cost:8500.00 },
    { codi:'HER003', descr:'Abatidor de temperatura Electrolux',  type:'Maquinaria',  unit:'ud',  cost:3200.00 },
    { codi:'HER004', descr:'Envasadora al vacío Orved VM18',      type:'Maquinaria',  unit:'ud',  cost:1850.00 },
    { codi:'HER005', descr:'Batidora de brazo Bamix',             type:'Maquinaria',  unit:'ud',  cost:320.00  },
    { codi:'HER006', descr:'Cortadora de fiambre Berkel',         type:'Maquinaria',  unit:'ud',  cost:1200.00 },
    { codi:'HER007', descr:'Sifón ISI Gourmet Whip 0.5L',        type:'Utensilio',   unit:'ud',  cost:89.00   },
    { codi:'HER008', descr:'Sartén de hierro fundido 28cm',       type:'Utensilio',   unit:'ud',  cost:65.00   },
    { codi:'HER009', descr:'Sartén antiadherente profesional 32cm',type:'Utensilio',  unit:'ud',  cost:45.00   },
    { codi:'HER010', descr:'Termómetro digital Thermapen MK4',    type:'Utensilio',   unit:'ud',  cost:98.00   },
    { codi:'HER011', descr:'Tabla HACCP verde (60x40cm)',          type:'Utensilio',  unit:'ud',  cost:22.00   },
    { codi:'HER012', descr:'Tabla HACCP roja (60x40cm)',           type:'Utensilio',  unit:'ud',  cost:22.00   },
    { codi:'HER013', descr:'Tabla HACCP blanca (60x40cm)',         type:'Utensilio',  unit:'ud',  cost:22.00   },
    { codi:'HER014', descr:'Cuchillo japonés Santoku Shun 18cm',  type:'Cuchillería', unit:'ud',  cost:185.00  },
    { codi:'HER015', descr:'Cuchillo de chef Global G-2 20cm',    type:'Cuchillería', unit:'ud',  cost:120.00  },
    { codi:'HER016', descr:'Mandolina japonesa Benriner',         type:'Utensilio',   unit:'ud',  cost:58.00   },
    { codi:'HER017', descr:'Soplete de cocina Rösle',             type:'Utensilio',   unit:'ud',  cost:75.00   },
    { codi:'HER018', descr:'Báscula de precisión 0.01g',          type:'Utensilio',   unit:'ud',  cost:42.00   },
  ]
  for (const h of herramientas) {
    db.prepare(`INSERT INTO herramientas (user_id,codi,descr,type,unit,cost,has_data) VALUES (?,?,?,?,?,?,1)`)
      .run(uid,h.codi,h.descr,h.type,h.unit,h.cost)
  }

  // ── PEDIDOS COMPRA (6 meses) ─────────────────────────────────────────────
  const pedidos = [
    // Este mes
    { num:'PED-20260424-001', vendor:'Mercabarna Express SL',          date_order:dAgo(1),  date_reception:dAgo(0),  sent_by:'email', total:342.80 },
    { num:'PED-20260423-001', vendor:'Pescados del Atlántico SA',      date_order:dAgo(2),  date_reception:dAgo(1),  sent_by:'email', total:687.40 },
    { num:'PED-20260422-001', vendor:'Carnes Selectas Martínez',       date_order:dAgo(3),  date_reception:dAgo(2),  sent_by:'email', total:524.60 },
    { num:'PED-20260420-001', vendor:'Lácteos Frescos del Pirineo',    date_order:dAgo(5),  date_reception:dAgo(4),  sent_by:'email', total:198.30 },
    { num:'PED-20260419-001', vendor:'Aceites García e Hijos',         date_order:dAgo(6),  date_reception:dAgo(5),  sent_by:'email', total:413.00 },
    { num:'PED-20260417-001', vendor:'Mercabarna Express SL',          date_order:dAgo(8),  date_reception:dAgo(7),  sent_by:'whatsapp', total:289.50 },
    { num:'PED-20260416-001', vendor:'Harinera del Norte SL',          date_order:dAgo(9),  date_reception:dAgo(8),  sent_by:'email', total:156.75 },
    { num:'PED-20260415-001', vendor:'Bodegas Rioja Premium',          date_order:dAgo(10), date_reception:dAgo(9),  sent_by:'email', total:892.00 },
    { num:'PED-20260413-001', vendor:'Pescados del Atlántico SA',      date_order:dAgo(12), date_reception:dAgo(11), sent_by:'email', total:445.20 },
    { num:'PED-20260411-001', vendor:'Distribuciones Roca Alimentación', date_order:dAgo(14), date_reception:dAgo(13), sent_by:'email', total:678.90 },
    { num:'PED-20260410-001', vendor:'Mariscos Costa Brava SL',        date_order:dAgo(15), date_reception:dAgo(14), sent_by:'whatsapp', total:523.40 },
    { num:'PED-20260408-001', vendor:'Charcutería Ibérica Extremeña',  date_order:dAgo(17), date_reception:dAgo(16), sent_by:'email', total:845.00 },
    { num:'PED-20260407-001', vendor:'Ecológicos del Valle SL',        date_order:dAgo(18), date_reception:dAgo(17), sent_by:'email', total:312.60 },
    { num:'PED-20260405-001', vendor:'Verduras del Mediterráneo SL',   date_order:dAgo(20), date_reception:dAgo(19), sent_by:'whatsapp', total:198.40 },
    { num:'PED-20260403-001', vendor:'Cafés y Especias del Mundo',     date_order:dAgo(22), date_reception:dAgo(21), sent_by:'email', total:267.30 },
    // Mes anterior
    { num:'PED-20260322-001', vendor:'Mercabarna Express SL',          date_order:mAgo(1,22), date_reception:mAgo(1,23), sent_by:'email', total:318.40 },
    { num:'PED-20260320-001', vendor:'Carnes Selectas Martínez',       date_order:mAgo(1,20), date_reception:mAgo(1,21), sent_by:'email', total:612.80 },
    { num:'PED-20260318-001', vendor:'Pescados del Atlántico SA',      date_order:mAgo(1,18), date_reception:mAgo(1,19), sent_by:'email', total:523.10 },
    { num:'PED-20260315-001', vendor:'Aceites García e Hijos',         date_order:mAgo(1,15), date_reception:mAgo(1,16), sent_by:'email', total:310.00 },
    { num:'PED-20260312-001', vendor:'Bodegas Rioja Premium',          date_order:mAgo(1,12), date_reception:mAgo(1,13), sent_by:'email', total:760.00 },
    { num:'PED-20260310-001', vendor:'Harinera del Norte SL',          date_order:mAgo(1,10), date_reception:mAgo(1,11), sent_by:'email', total:189.50 },
    { num:'PED-20260308-001', vendor:'Lácteos Frescos del Pirineo',    date_order:mAgo(1,8),  date_reception:mAgo(1,9),  sent_by:'email', total:245.60 },
    { num:'PED-20260305-001', vendor:'Mariscos Costa Brava SL',        date_order:mAgo(1,5),  date_reception:mAgo(1,6),  sent_by:'whatsapp', total:612.80 },
    { num:'PED-20260303-001', vendor:'Charcutería Ibérica Extremeña',  date_order:mAgo(1,3),  date_reception:mAgo(1,4),  sent_by:'email', total:920.00 },
    // 2 meses atrás
    { num:'PED-20260222-001', vendor:'Mercabarna Express SL',          date_order:mAgo(2,22), date_reception:mAgo(2,23), sent_by:'email', total:298.60 },
    { num:'PED-20260218-001', vendor:'Carnes Selectas Martínez',       date_order:mAgo(2,18), date_reception:mAgo(2,19), sent_by:'email', total:580.00 },
    { num:'PED-20260215-001', vendor:'Lácteos Frescos del Pirineo',    date_order:mAgo(2,15), date_reception:mAgo(2,16), sent_by:'email', total:175.20 },
    { num:'PED-20260212-001', vendor:'Bodegas Rioja Premium',          date_order:mAgo(2,12), date_reception:mAgo(2,13), sent_by:'email', total:840.00 },
    { num:'PED-20260210-001', vendor:'Pescados del Atlántico SA',      date_order:mAgo(2,10), date_reception:mAgo(2,11), sent_by:'email', total:490.80 },
    { num:'PED-20260208-001', vendor:'Distribuciones Roca Alimentación', date_order:mAgo(2,8), date_reception:mAgo(2,9), sent_by:'email', total:734.20 },
    // 3 meses atrás
    { num:'PED-20260122-001', vendor:'Mercabarna Express SL',          date_order:mAgo(3,22), date_reception:mAgo(3,23), sent_by:'email', total:276.40 },
    { num:'PED-20260118-001', vendor:'Carnes Selectas Martínez',       date_order:mAgo(3,18), date_reception:mAgo(3,19), sent_by:'email', total:543.20 },
    { num:'PED-20260115-001', vendor:'Congelados Premium Norte SA',    date_order:mAgo(3,15), date_reception:mAgo(3,16), sent_by:'email', total:1240.00 },
    { num:'PED-20260112-001', vendor:'Bodegas Rioja Premium',          date_order:mAgo(3,12), date_reception:mAgo(3,13), sent_by:'email', total:680.00 },
    // 4 meses atrás
    { num:'PED-20251222-001', vendor:'Mercabarna Express SL',          date_order:mAgo(4,22), date_reception:mAgo(4,23), sent_by:'email', total:412.80 },
    { num:'PED-20251215-001', vendor:'Charcutería Ibérica Extremeña',  date_order:mAgo(4,15), date_reception:mAgo(4,16), sent_by:'email', total:1580.00 },
    { num:'PED-20251210-001', vendor:'Bodegas Rioja Premium',          date_order:mAgo(4,10), date_reception:mAgo(4,11), sent_by:'email', total:2240.00 },
    // 5 meses atrás
    { num:'PED-20251122-001', vendor:'Mercabarna Express SL',          date_order:mAgo(5,22), date_reception:mAgo(5,23), sent_by:'email', total:322.40 },
    { num:'PED-20251118-001', vendor:'Carnes Selectas Martínez',       date_order:mAgo(5,18), date_reception:mAgo(5,19), sent_by:'email', total:498.60 },
    { num:'PED-20251115-001', vendor:'Pescados del Atlántico SA',      date_order:mAgo(5,15), date_reception:mAgo(5,16), sent_by:'email', total:380.20 },
  ]
  for (const p of pedidos) {
    db.prepare(`INSERT INTO pedidos_compra (user_id,num_order,vendor,date_order,date_reception,sent_by,total) VALUES (?,?,?,?,?,?,?)`)
      .run(uid,p.num,p.vendor,p.date_order,p.date_reception,p.sent_by,p.total)
  }

  // ── LISTA PEDIDOS ─────────────────────────────────────────────────────────
  const yr = today.getFullYear(), mo = today.getMonth()+1
  for (const lp of [
    { descr:'Pedido semanal verduras — Mercabarna',    year:yr, month:mo,   pending_send:0, pending_receive:0 },
    { descr:'Pedido pescado lunes — Atlántico',        year:yr, month:mo,   pending_send:0, pending_receive:1 },
    { descr:'Pedido carnes semana — Martínez',         year:yr, month:mo,   pending_send:1, pending_receive:0 },
    { descr:'Pedido lácteos quincenal — Pirineo',      year:yr, month:mo,   pending_send:1, pending_receive:1 },
    { descr:'Pedido vinos mensual — Rioja Premium',    year:yr, month:mo,   pending_send:0, pending_receive:0 },
    { descr:'Pedido mariscos especial — Costa Brava',  year:yr, month:mo,   pending_send:1, pending_receive:0 },
    { descr:'Pedido charcutería ibérica',              year:yr, month:mo-1, pending_send:0, pending_receive:0 },
    { descr:'Pedido especias trimestral',              year:yr, month:mo-1, pending_send:0, pending_receive:0 },
    { descr:'Pedido congelados enero',                 year:yr, month:mo-3, pending_send:0, pending_receive:0 },
    { descr:'Pedido navidad — Rioja Premium',          year:yr, month:mo-4, pending_send:0, pending_receive:0 },
  ]) {
    db.prepare(`INSERT INTO lista_pedidos (user_id,descr,year,month,pending_send,pending_receive,locked,replicated) VALUES (?,?,?,?,?,?,0,0)`)
      .run(uid,lp.descr,lp.year,lp.month,lp.pending_send,lp.pending_receive)
  }

  // ── ALBARANES COMPRA ──────────────────────────────────────────────────────
  const albaranes = [
    { delivery_num:'ALB-20260424-001', vendor:'Mercabarna Express SL',       date_delivery:dAgo(1),  base:283.30, taxes:59.49,  total:342.80, received_by:'Pablo', cost_type:'Variable', vendor_type:'Frutas y Verduras' },
    { delivery_num:'ALB-20260423-001', vendor:'Pescados del Atlántico SA',   date_delivery:dAgo(1),  base:568.26, taxes:119.13, total:687.40, received_by:'Chef',  cost_type:'Variable', vendor_type:'Pescadería' },
    { delivery_num:'ALB-20260422-001', vendor:'Carnes Selectas Martínez',    date_delivery:dAgo(2),  base:433.55, taxes:91.05,  total:524.60, received_by:'Pablo', cost_type:'Variable', vendor_type:'Carnicería' },
    { delivery_num:'ALB-20260420-001', vendor:'Lácteos Frescos del Pirineo', date_delivery:dAgo(4),  base:163.88, taxes:34.41,  total:198.30, received_by:'Pablo', cost_type:'Variable', vendor_type:'Lácteos' },
    { delivery_num:'ALB-20260419-001', vendor:'Aceites García e Hijos',      date_delivery:dAgo(5),  base:341.32, taxes:71.68,  total:413.00, received_by:'Pablo', cost_type:'Fijo',     vendor_type:'Aceites' },
    { delivery_num:'ALB-20260417-001', vendor:'Mercabarna Express SL',       date_delivery:dAgo(7),  base:239.26, taxes:50.25,  total:289.50, received_by:'Chef',  cost_type:'Variable', vendor_type:'Frutas y Verduras' },
    { delivery_num:'ALB-20260416-001', vendor:'Harinera del Norte SL',       date_delivery:dAgo(8),  base:129.55, taxes:27.21,  total:156.75, received_by:'Pablo', cost_type:'Fijo',     vendor_type:'Harinas' },
    { delivery_num:'ALB-20260415-001', vendor:'Bodegas Rioja Premium',       date_delivery:dAgo(9),  base:737.19, taxes:154.81, total:892.00, received_by:'Pablo', cost_type:'Fijo',     vendor_type:'Bebidas' },
    { delivery_num:'ALB-20260413-001', vendor:'Pescados del Atlántico SA',   date_delivery:dAgo(11), base:367.93, taxes:77.27,  total:445.20, received_by:'Chef',  cost_type:'Variable', vendor_type:'Pescadería' },
    { delivery_num:'ALB-20260411-001', vendor:'Distribuciones Roca',         date_delivery:dAgo(13), base:560.66, taxes:117.74, total:678.40, received_by:'Pablo', cost_type:'Variable', vendor_type:'General' },
    { delivery_num:'ALB-20260410-001', vendor:'Mariscos Costa Brava SL',     date_delivery:dAgo(14), base:432.56, taxes:90.84,  total:523.40, received_by:'Chef',  cost_type:'Variable', vendor_type:'Marisco' },
    { delivery_num:'ALB-20260408-001', vendor:'Charcutería Ibérica',         date_delivery:dAgo(16), base:698.35, taxes:146.65, total:845.00, received_by:'Pablo', cost_type:'Fijo',     vendor_type:'Charcutería' },
    { delivery_num:'ALB-20260322-001', vendor:'Mercabarna Express SL',       date_delivery:mAgo(1,22), base:263.14, taxes:55.26, total:318.40, received_by:'Pablo', cost_type:'Variable', vendor_type:'Frutas y Verduras' },
    { delivery_num:'ALB-20260320-001', vendor:'Carnes Selectas Martínez',    date_delivery:mAgo(1,20), base:506.45, taxes:106.35, total:612.80, received_by:'Chef', cost_type:'Variable', vendor_type:'Carnicería' },
    { delivery_num:'ALB-20260318-001', vendor:'Pescados del Atlántico SA',   date_delivery:mAgo(1,18), base:432.31, taxes:90.85, total:523.10, received_by:'Pablo', cost_type:'Variable', vendor_type:'Pescadería' },
    { delivery_num:'ALB-20260315-001', vendor:'Mariscos Costa Brava SL',     date_delivery:mAgo(1,15), base:506.45, taxes:106.35, total:612.80, received_by:'Chef', cost_type:'Variable', vendor_type:'Marisco' },
  ]
  for (const a of albaranes) {
    db.prepare(`INSERT INTO albaranes_compra (user_id,delivery_num,vendor,date_delivery,base,taxes,total,received_by,cost_type,vendor_type) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(uid,a.delivery_num,a.vendor,a.date_delivery,a.base,a.taxes,a.total,a.received_by,a.cost_type,a.vendor_type)
  }

  // ── FACTURAS COMPRA ───────────────────────────────────────────────────────
  const facturas = [
    // Vencidas (urgente)
    { num:'FAC-2026-0089', vendor:'Mercabarna Express SL',       date_invoice:dAgo(30), date_due:dAgo(10), base:522.56,  taxes:109.74, total:632.30,  paid:0, validated:1 },
    { num:'FAC-2026-0088', vendor:'Pescados del Atlántico SA',   date_invoice:dAgo(28), date_due:dAgo(8),  base:993.45,  taxes:208.62, total:1202.07, paid:0, validated:1 },
    { num:'FAC-2026-0087', vendor:'Mariscos Costa Brava SL',     date_invoice:dAgo(25), date_due:dAgo(5),  base:432.56,  taxes:90.84,  total:523.40,  paid:0, validated:1 },
    { num:'FAC-2026-0086', vendor:'Charcutería Ibérica',         date_invoice:dAgo(35), date_due:dAgo(15), base:698.35,  taxes:146.65, total:845.00,  paid:0, validated:1 },
    { num:'FAC-2026-0085', vendor:'Distribuciones Roca',         date_invoice:dAgo(40), date_due:dAgo(20), base:560.66,  taxes:117.74, total:678.40,  paid:0, validated:0 },
    // Próximas a vencer (7 días)
    { num:'FAC-2026-0084', vendor:'Carnes Selectas Martínez',    date_invoice:dAgo(20), date_due:dAgo(-3), base:866.45,  taxes:181.95, total:1048.40, paid:0, validated:1 },
    { num:'FAC-2026-0083', vendor:'Aceites García e Hijos',      date_invoice:dAgo(18), date_due:dAgo(-5), base:341.32,  taxes:71.68,  total:413.00,  paid:0, validated:1 },
    // Pendientes normales
    { num:'FAC-2026-0082', vendor:'Lácteos Frescos del Pirineo', date_invoice:dAgo(15), date_due:dAgo(-15), base:163.88, taxes:34.41,  total:198.30,  paid:0, validated:1 },
    { num:'FAC-2026-0081', vendor:'Harinera del Norte SL',       date_invoice:dAgo(12), date_due:dAgo(-18), base:129.55, taxes:27.21,  total:156.75,  paid:0, validated:1 },
    { num:'FAC-2026-0080', vendor:'Ecológicos del Valle SL',     date_invoice:dAgo(10), date_due:dAgo(-20), base:258.35, taxes:54.25,  total:312.60,  paid:0, validated:1 },
    // Pagadas
    { num:'FAC-2026-0079', vendor:'Bodegas Rioja Premium',       date_invoice:dAgo(45), date_due:dAgo(15), base:737.19,  taxes:154.81, total:892.00,  paid:1, validated:1 },
    { num:'FAC-2026-0078', vendor:'Mercabarna Express SL',       date_invoice:dAgo(50), date_due:dAgo(20), base:263.14,  taxes:55.26,  total:318.40,  paid:1, validated:1 },
    { num:'FAC-2026-0077', vendor:'Carnes Selectas Martínez',    date_invoice:dAgo(55), date_due:dAgo(25), base:506.45,  taxes:106.35, total:612.80,  paid:1, validated:1 },
    { num:'FAC-2026-0076', vendor:'Pescados del Atlántico SA',   date_invoice:mAgo(2,10), date_due:mAgo(1,25), base:432.31, taxes:90.85, total:523.10, paid:1, validated:1 },
    { num:'FAC-2026-0075', vendor:'Bodegas Rioja Premium',       date_invoice:mAgo(2,5),  date_due:mAgo(1,20), base:694.21, taxes:145.78, total:840.00, paid:1, validated:1 },
    { num:'FAC-2025-0210', vendor:'Charcutería Ibérica',         date_invoice:mAgo(4,10), date_due:mAgo(3,25), base:1305.79, taxes:274.22, total:1580.00, paid:1, validated:1 },
    { num:'FAC-2025-0185', vendor:'Bodegas Rioja Premium',       date_invoice:mAgo(4,5),  date_due:mAgo(3,20), base:1851.24, taxes:388.76, total:2240.00, paid:1, validated:1 },
  ]
  for (const f of facturas) {
    db.prepare(`INSERT INTO facturas_compra (user_id,invoice_num,vendor,date_invoice,date_due,base,taxes,total,paid,validated) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(uid,f.num,f.vendor,f.date_invoice,f.date_due,f.base,f.taxes,f.total,f.paid,f.validated)
  }

  // ── ALBARANES VENTA ───────────────────────────────────────────────────────
  const clientes = ['Hotel Arts Barcelona','Catering Premium SL','Eventos Corporativos BCN','Restaurante La Mar','Hotel Ritz Madrid','Fundació Joan Miró (eventos)']
  const tiposCliente = ['Hotel','Catering','Eventos','Restaurante','Hotel','Fundación']
  for (let i = 0; i < 20; i++) {
    const ci = i % clientes.length
    db.prepare(`INSERT INTO albaranes_venta (user_id,invoice_num,customer,customer_type,date_delivery,base) VALUES (?,?,?,?,?,?)`)
      .run(uid,`AVE-2026-${String(i+1).padStart(3,'0')}`,clientes[ci],tiposCliente[ci],dAgo(i*2+1),900+i*120)
  }

  // ── FACTURAS VENTA ────────────────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const ci = i % clientes.length
    const base = 1200 + i * 350
    const taxes = Math.round(base * 0.21 * 100) / 100
    const total = base + taxes
    db.prepare(`INSERT INTO facturas_venta (user_id,invoice_num,customer,date_invoice,date_due,base,taxes,total,paid) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid,`FVE-2026-${String(i+1).padStart(3,'0')}`,clientes[ci],dAgo(i*8+2),dAgo(i*8-28),base,taxes,total, i < 8 ? 1 : 0)
  }

  // ── PRECIO HISTORIAL (evolución 6 meses) ─────────────────────────────────
  const histPrecios = [
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precios:[
      { precio:4.20, fecha:mAgo(6,1) }, { precio:4.50, fecha:mAgo(5,1) }, { precio:4.80, fecha:mAgo(4,1) },
      { precio:5.20, fecha:mAgo(3,1) }, { precio:5.60, fecha:mAgo(2,1) }, { precio:6.20, fecha:mAgo(1,1) }, { precio:6.20, fecha:dAgo(10) },
    ]},
    { nombre:'Salmón fresco (lomo)', vendor:'Pescados del Atlántico SA', precios:[
      { precio:11.80, fecha:mAgo(6,1) }, { precio:12.40, fecha:mAgo(5,1) }, { precio:13.20, fecha:mAgo(4,1) },
      { precio:13.80, fecha:mAgo(3,1) }, { precio:14.50, fecha:mAgo(2,1) }, { precio:15.20, fecha:mAgo(1,1) }, { precio:15.20, fecha:dAgo(5) },
    ]},
    { nombre:'Gambas rojas (16/20)', vendor:'Pescados del Atlántico SA', precios:[
      { precio:22.00, fecha:mAgo(4,1) }, { precio:24.00, fecha:mAgo(3,1) },
      { precio:26.50, fecha:mAgo(2,1) }, { precio:28.50, fecha:mAgo(1,1) }, { precio:28.50, fecha:dAgo(8) },
    ]},
    { nombre:'Nata líquida 35% MG', vendor:'Lácteos Frescos del Pirineo', precios:[
      { precio:1.80, fecha:mAgo(5,1) }, { precio:1.95, fecha:mAgo(4,1) },
      { precio:2.10, fecha:mAgo(3,1) }, { precio:2.30, fecha:mAgo(2,1) }, { precio:2.30, fecha:dAgo(20) },
    ]},
    { nombre:'Pechuga de pollo (filetes)', vendor:'Carnes Selectas Martínez', precios:[
      { precio:7.20, fecha:mAgo(5,1) }, { precio:6.80, fecha:mAgo(4,1) }, { precio:6.50, fecha:mAgo(3,1) },
      { precio:6.20, fecha:mAgo(2,1) }, { precio:6.20, fecha:dAgo(15) },
    ]},
    { nombre:'Harina de trigo T55', vendor:'Harinera del Norte SL', precios:[
      { precio:0.72, fecha:mAgo(5,1) }, { precio:0.78, fecha:mAgo(4,1) },
      { precio:0.82, fecha:mAgo(3,1) }, { precio:0.87, fecha:mAgo(2,1) }, { precio:0.87, fecha:mAgo(1,1) },
    ]},
    { nombre:'Solomillo de ternera', vendor:'Carnes Selectas Martínez', precios:[
      { precio:28.00, fecha:mAgo(4,1) }, { precio:29.50, fecha:mAgo(3,1) },
      { precio:31.00, fecha:mAgo(2,1) }, { precio:32.00, fecha:mAgo(1,1) }, { precio:32.00, fecha:dAgo(12) },
    ]},
    { nombre:'Atún rojo (sashimi)', vendor:'Mariscos Costa Brava SL', precios:[
      { precio:36.00, fecha:mAgo(3,1) }, { precio:38.50, fecha:mAgo(2,1) },
      { precio:40.00, fecha:mAgo(1,1) }, { precio:42.00, fecha:dAgo(14) },
    ]},
    { nombre:'Foie gras mi-cuit', vendor:'Charcutería Ibérica Extremeña', precios:[
      { precio:58.00, fecha:mAgo(4,1) }, { precio:62.00, fecha:mAgo(3,1) },
      { precio:65.00, fecha:mAgo(2,1) }, { precio:68.00, fecha:mAgo(1,1) },
    ]},
  ]
  for (const h of histPrecios) {
    for (const pp of h.precios) {
      db.prepare(`INSERT INTO precio_historial (user_id,nombre,vendor,precio,unidad,fecha,fuente) VALUES (?,?,?,?,?,'kg','albaran')`)
        .run(uid,h.nombre,h.vendor,pp.precio,pp.fecha)
    }
  }

  // ── MERMA REGISTRO (2 meses) ──────────────────────────────────────────────
  const mermas = [
    // Este mes
    { nombre:'Salmón fresco (lomo)', cantidad:1.2, unidad:'kg', motivo:'caducidad', coste_estimado:18.24, fecha:dAgo(2),  notas:'Llegó en mal estado del proveedor' },
    { nombre:'Tomate rama madurado', cantidad:3.5, unidad:'kg', motivo:'caducidad', coste_estimado:6.30,  fecha:dAgo(4),  notas:'Sobrestock fin de semana largo' },
    { nombre:'Nata líquida 35% MG', cantidad:2.0, unidad:'l',  motivo:'sobreproducción', coste_estimado:4.60, fecha:dAgo(5), notas:'Exceso mise en place servicio noche' },
    { nombre:'Pan de molde brioche', cantidad:8,   unidad:'ud', motivo:'caducidad', coste_estimado:9.60,  fecha:dAgo(6),  notas:'No se vendió la tanda del domingo' },
    { nombre:'Costilla de cerdo ibérico', cantidad:0.8, unidad:'kg', motivo:'rotura', coste_estimado:6.88, fecha:dAgo(8), notas:'Caída en cámara frigorífica' },
    { nombre:'Pechuga de pollo (filetes)', cantidad:0.5, unidad:'kg', motivo:'pérdida', coste_estimado:3.10, fecha:dAgo(10), notas:null },
    { nombre:'Aceite de oliva virgen extra', cantidad:0.5, unidad:'l', motivo:'rotura', coste_estimado:3.10, fecha:dAgo(12), notas:'Botella rota durante el servicio' },
    { nombre:'Gambas rojas (16/20)', cantidad:0.4, unidad:'kg', motivo:'caducidad', coste_estimado:11.40, fecha:dAgo(3),  notas:null },
    { nombre:'Merluza fresca (filete)', cantidad:0.6, unidad:'kg', motivo:'sobreproducción', coste_estimado:5.88, fecha:dAgo(1), notas:null },
    { nombre:'Fresas frescas (bandeja 500g)', cantidad:0.8, unidad:'kg', motivo:'caducidad', coste_estimado:4.00, fecha:dAgo(1), notas:null },
    { nombre:'Espárrago verde (calibre 16)', cantidad:0.3, unidad:'kg', motivo:'caducidad', coste_estimado:1.44, fecha:dAgo(2), notas:null },
    { nombre:'Huevos camperos L (docena)', cantidad:6,   unidad:'ud', motivo:'rotura', coste_estimado:1.68, fecha:dAgo(7),  notas:null },
    { nombre:'Seta shiitake fresca', cantidad:0.4, unidad:'kg', motivo:'caducidad', coste_estimado:4.80, fecha:dAgo(9), notas:'Entrega retrasada por proveedor' },
    { nombre:'Frambuesa fresca', cantidad:0.3, unidad:'kg', motivo:'caducidad', coste_estimado:5.40, fecha:dAgo(11), notas:null },
    { nombre:'Atún rojo (sashimi)', cantidad:0.2, unidad:'kg', motivo:'sobreproducción', coste_estimado:8.40, fecha:dAgo(13), notas:'Servicio de mediodía con pocas reservas' },
    // Mes anterior
    { nombre:'Bacalao desalado', cantidad:0.9, unidad:'kg', motivo:'pérdida', coste_estimado:10.44, fecha:mAgo(1,28), notas:'Descongelación involuntaria — apagón' },
    { nombre:'Queso manchego curado', cantidad:0.4, unidad:'kg', motivo:'caducidad', coste_estimado:5.68, fecha:mAgo(1,25), notas:null },
    { nombre:'Foie gras mi-cuit', cantidad:0.1, unidad:'kg', motivo:'sobreproducción', coste_estimado:6.80, fecha:mAgo(1,22), notas:'No se vendió el menú degustación' },
    { nombre:'Caldo de pollo (envase 1L)', cantidad:3, unidad:'l', motivo:'sobreproducción', coste_estimado:3.60, fecha:mAgo(1,20), notas:null },
    { nombre:'Espinaca baby (bolsa)', cantidad:0.5, unidad:'kg', motivo:'caducidad', coste_estimado:2.60, fecha:mAgo(1,18), notas:null },
    { nombre:'Vieiras (concha)', cantidad:4, unidad:'ud', motivo:'caducidad', coste_estimado:11.20, fecha:mAgo(1,15), notas:'Llegaron dañadas en el transporte' },
    { nombre:'Mantequilla sin sal (placa)', cantidad:0.3, unidad:'kg', motivo:'sobreproducción', coste_estimado:2.52, fecha:mAgo(1,12), notas:null },
    { nombre:'Mango (extra)', cantidad:1.5, unidad:'kg', motivo:'caducidad', coste_estimado:5.70, fecha:mAgo(1,10), notas:'Maduración muy rápida' },
    { nombre:'Puerro fresco', cantidad:1.0, unidad:'kg', motivo:'caducidad', coste_estimado:1.60, fecha:mAgo(1,8), notas:null },
    { nombre:'Albahaca fresca (maceta)', cantidad:3, unidad:'ud', motivo:'caducidad', coste_estimado:5.40, fecha:mAgo(1,5), notas:'No se usó en el servicio del fin de semana' },
  ]
  for (const m of mermas) {
    db.prepare(`INSERT INTO merma_registro (user_id,nombre,cantidad,unidad,motivo,coste_estimado,fecha,notas) VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid,m.nombre,m.cantidad,m.unidad,m.motivo,m.coste_estimado,m.fecha,m.notas)
  }

  // ── LINEAS ALBARÁN (comparativa precios proveedores) ──────────────────────
  const lineas = [
    { vendor:'Mercabarna Express SL',       nombre:'Tomate rama madurado',         cantidad:20, unidad:'kg', precio_unitario:1.80, total_linea:36.00,  fecha:dAgo(7)  },
    { vendor:'Distribuciones Roca',         nombre:'Tomate rama madurado',         cantidad:15, unidad:'kg', precio_unitario:2.40, total_linea:36.00,  fecha:dAgo(3)  },
    { vendor:'Ecológicos del Valle SL',     nombre:'Tomate rama madurado',         cantidad:10, unidad:'kg', precio_unitario:3.10, total_linea:31.00,  fecha:dAgo(5)  },
    { vendor:'Aceites García e Hijos',      nombre:'Aceite de oliva virgen extra', cantidad:30, unidad:'l',  precio_unitario:6.20, total_linea:186.00, fecha:dAgo(10) },
    { vendor:'Distribuciones Roca',         nombre:'Aceite de oliva virgen extra', cantidad:10, unidad:'l',  precio_unitario:4.90, total_linea:49.00,  fecha:dAgo(12) },
    { vendor:'Pescados del Atlántico SA',   nombre:'Salmón fresco (lomo)',         cantidad:15, unidad:'kg', precio_unitario:15.20, total_linea:228.00, fecha:dAgo(5) },
    { vendor:'Mercabarna Express SL',       nombre:'Salmón fresco (lomo)',         cantidad:5,  unidad:'kg', precio_unitario:12.50, total_linea:62.50,  fecha:dAgo(7) },
    { vendor:'Carnes Selectas Martínez',    nombre:'Pechuga de pollo (filetes)',   cantidad:25, unidad:'kg', precio_unitario:6.20, total_linea:155.00, fecha:dAgo(4)  },
    { vendor:'Distribuciones Roca',         nombre:'Pechuga de pollo (filetes)',   cantidad:10, unidad:'kg', precio_unitario:7.10, total_linea:71.00,  fecha:dAgo(3)  },
    { vendor:'Lácteos Frescos del Pirineo', nombre:'Nata líquida 35% MG',         cantidad:20, unidad:'l',  precio_unitario:2.30, total_linea:46.00,  fecha:dAgo(6)  },
    { vendor:'Harinera del Norte SL',       nombre:'Harina de trigo T55',          cantidad:50, unidad:'kg', precio_unitario:0.87, total_linea:43.50,  fecha:dAgo(9)  },
    { vendor:'Pescados del Atlántico SA',   nombre:'Gambas rojas (16/20)',         cantidad:8,  unidad:'kg', precio_unitario:28.50, total_linea:228.00, fecha:dAgo(5) },
    { vendor:'Mariscos Costa Brava SL',     nombre:'Gambas rojas (16/20)',         cantidad:5,  unidad:'kg', precio_unitario:31.00, total_linea:155.00, fecha:dAgo(3) },
    { vendor:'Mercabarna Express SL',       nombre:'Espárrago verde (calibre 16)', cantidad:5,  unidad:'kg', precio_unitario:4.80, total_linea:24.00,  fecha:dAgo(7)  },
    { vendor:'Verduras del Mediterráneo',   nombre:'Espárrago verde (calibre 16)', cantidad:8,  unidad:'kg', precio_unitario:4.20, total_linea:33.60,  fecha:dAgo(4)  },
    { vendor:'Carnes Selectas Martínez',    nombre:'Solomillo de ternera',         cantidad:6,  unidad:'kg', precio_unitario:32.00, total_linea:192.00, fecha:dAgo(4) },
    { vendor:'Mariscos Costa Brava SL',     nombre:'Atún rojo (sashimi)',          cantidad:4,  unidad:'kg', precio_unitario:42.00, total_linea:168.00, fecha:dAgo(14) },
    { vendor:'Charcutería Ibérica',         nombre:'Foie gras mi-cuit',            cantidad:2,  unidad:'kg', precio_unitario:68.00, total_linea:136.00, fecha:dAgo(16) },
  ]
  for (const l of lineas) {
    db.prepare(`INSERT INTO lineas_albaran_compra (user_id,vendor,nombre,cantidad,unidad,precio_unitario,total_linea,fecha) VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid,l.vendor,l.nombre,l.cantidad,l.unidad,l.precio_unitario,l.total_linea,l.fecha)
  }

  // ── ESCANDALLO RECETAS ────────────────────────────────────────────────────
  const recetas = [
    { nombre:'Salmón a la plancha con velouté de espárragos', categoria:'Segundos', raciones:1, precio_venta:24.00, merma_pct:8, lineas:[
      { nombre_libre:'Salmón fresco (lomo)',           cantidad:0.180, unidad:'kg', coste_unitario:15.20 },
      { nombre_libre:'Espárrago verde (calibre 16)',   cantidad:0.080, unidad:'kg', coste_unitario:4.80  },
      { nombre_libre:'Nata líquida 35% MG',            cantidad:0.050, unidad:'l',  coste_unitario:2.30  },
      { nombre_libre:'Aceite de oliva virgen extra',   cantidad:0.020, unidad:'l',  coste_unitario:6.20  },
      { nombre_libre:'Mantequilla sin sal (placa)',     cantidad:0.015, unidad:'kg', coste_unitario:8.40  },
    ]},
    { nombre:'Arroz negro con gambas y alioli de tinta', categoria:'Arroces', raciones:1, precio_venta:26.00, merma_pct:10, lineas:[
      { nombre_libre:'Arroz bomba (DO Valencia)',      cantidad:0.100, unidad:'kg', coste_unitario:2.10  },
      { nombre_libre:'Gambas rojas (16/20)',           cantidad:0.120, unidad:'kg', coste_unitario:28.50 },
      { nombre_libre:'Fumet de pescado',               cantidad:0.300, unidad:'l',  coste_unitario:2.40  },
      { nombre_libre:'Aceite de oliva virgen extra',   cantidad:0.025, unidad:'l',  coste_unitario:6.20  },
      { nombre_libre:'Cebolla blanca grande',          cantidad:0.060, unidad:'kg', coste_unitario:0.60  },
    ]},
    { nombre:'Solomillo al foie con reducción de Rioja', categoria:'Segundos', raciones:1, precio_venta:42.00, merma_pct:8, lineas:[
      { nombre_libre:'Solomillo de ternera',           cantidad:0.220, unidad:'kg', coste_unitario:32.00 },
      { nombre_libre:'Foie gras mi-cuit',              cantidad:0.040, unidad:'kg', coste_unitario:68.00 },
      { nombre_libre:'Mantequilla sin sal (placa)',     cantidad:0.020, unidad:'kg', coste_unitario:8.40  },
      { nombre_libre:'Vino tinto Rioja (cocina)',       cantidad:0.080, unidad:'l',  coste_unitario:3.60  },
      { nombre_libre:'Trufa negra rallada (tarro)',     cantidad:2.000, unidad:'g',  coste_unitario:0.85  },
    ]},
    { nombre:'Crema de tomate asado con albahaca', categoria:'Primeros', raciones:1, precio_venta:10.50, merma_pct:5, lineas:[
      { nombre_libre:'Tomate rama madurado',           cantidad:0.200, unidad:'kg', coste_unitario:1.80  },
      { nombre_libre:'Nata líquida 35% MG',            cantidad:0.050, unidad:'l',  coste_unitario:2.30  },
      { nombre_libre:'Cebolla blanca grande',          cantidad:0.040, unidad:'kg', coste_unitario:0.60  },
      { nombre_libre:'Aceite de oliva virgen extra',   cantidad:0.015, unidad:'l',  coste_unitario:6.20  },
      { nombre_libre:'Albahaca fresca (maceta)',       cantidad:0.005, unidad:'ud', coste_unitario:1.80  },
    ]},
    { nombre:'Pulpo a la gallega con cachelos y pimentón', categoria:'Entrantes', raciones:1, precio_venta:18.00, merma_pct:12, lineas:[
      { nombre_libre:'Pulpo cocido (tentáculos)',      cantidad:0.200, unidad:'kg', coste_unitario:12.40 },
      { nombre_libre:'Patata agria (Monalisa)',        cantidad:0.150, unidad:'kg', coste_unitario:0.55  },
      { nombre_libre:'Pimentón ahumado La Vera',       cantidad:0.003, unidad:'kg', coste_unitario:8.50  },
      { nombre_libre:'Aceite de oliva virgen extra',   cantidad:0.030, unidad:'l',  coste_unitario:6.20  },
      { nombre_libre:'Sal marina fina (saco 25kg)',   cantidad:0.005, unidad:'kg', coste_unitario:0.40  },
    ]},
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez', categoria:'Segundos', raciones:1, precio_venta:19.50, merma_pct:10, lineas:[
      { nombre_libre:'Carrillera de cerdo',            cantidad:0.280, unidad:'kg', coste_unitario:7.40  },
      { nombre_libre:'Cebolla blanca grande',          cantidad:0.080, unidad:'kg', coste_unitario:0.60  },
      { nombre_libre:'Zanahoria (pelada)',             cantidad:0.060, unidad:'kg', coste_unitario:0.75  },
      { nombre_libre:'Vino tinto Rioja (cocina)',       cantidad:0.120, unidad:'l',  coste_unitario:3.60  },
      { nombre_libre:'Fondo oscuro de ternera',        cantidad:0.150, unidad:'l',  coste_unitario:3.60  },
    ]},
    { nombre:'Vieiras con crema de coliflor y caviar', categoria:'Entrantes', raciones:1, precio_venta:22.00, merma_pct:8, lineas:[
      { nombre_libre:'Vieiras (concha)',               cantidad:3.000, unidad:'ud', coste_unitario:2.80  },
      { nombre_libre:'Nata líquida 35% MG',            cantidad:0.060, unidad:'l',  coste_unitario:2.30  },
      { nombre_libre:'Mantequilla sin sal (placa)',     cantidad:0.020, unidad:'kg', coste_unitario:8.40  },
      { nombre_libre:'Aceite de oliva virgen extra',   cantidad:0.015, unidad:'l',  coste_unitario:6.20  },
    ]},
    { nombre:'Tarta de chocolate negro con helado de vainilla', categoria:'Postres', raciones:1, precio_venta:8.50, merma_pct:10, lineas:[
      { nombre_libre:'Chocolate negro 70% (pastilla)', cantidad:0.080, unidad:'kg', coste_unitario:11.20 },
      { nombre_libre:'Mantequilla sin sal (placa)',     cantidad:0.040, unidad:'kg', coste_unitario:8.40  },
      { nombre_libre:'Huevos camperos L (docena)',      cantidad:2.000, unidad:'ud', coste_unitario:0.28  },
      { nombre_libre:'Azúcar blanco refinado',          cantidad:0.060, unidad:'kg', coste_unitario:0.95  },
      { nombre_libre:'Harina de trigo T55',            cantidad:0.030, unidad:'kg', coste_unitario:0.87  },
    ]},
    { nombre:'Panna cotta de frambuesa con coulis', categoria:'Postres', raciones:1, precio_venta:7.00, merma_pct:8, lineas:[
      { nombre_libre:'Nata líquida 35% MG',            cantidad:0.150, unidad:'l',  coste_unitario:2.30  },
      { nombre_libre:'Azúcar blanco refinado',          cantidad:0.040, unidad:'kg', coste_unitario:0.95  },
      { nombre_libre:'Frambuesa fresca',               cantidad:0.060, unidad:'kg', coste_unitario:18.00 },
    ]},
    { nombre:'Tataki de atún rojo con wakame y soja', categoria:'Entrantes', raciones:1, precio_venta:28.00, merma_pct:6, lineas:[
      { nombre_libre:'Atún rojo (sashimi)',            cantidad:0.120, unidad:'kg', coste_unitario:42.00 },
      { nombre_libre:'Aceite de girasol refinado',     cantidad:0.020, unidad:'l',  coste_unitario:1.40  },
      { nombre_libre:'Rúcula fresca (bolsa)',          cantidad:0.020, unidad:'kg', coste_unitario:6.80  },
    ]},
    { nombre:'Lubina al horno con patatas panaderas', categoria:'Segundos', raciones:1, precio_venta:28.00, merma_pct:15, lineas:[
      { nombre_libre:'Lubina fresca entera',           cantidad:0.350, unidad:'kg', coste_unitario:12.60 },
      { nombre_libre:'Patata agria (Monalisa)',        cantidad:0.200, unidad:'kg', coste_unitario:0.55  },
      { nombre_libre:'Cebolla blanca grande',          cantidad:0.080, unidad:'kg', coste_unitario:0.60  },
      { nombre_libre:'Aceite de oliva virgen extra',   cantidad:0.030, unidad:'l',  coste_unitario:6.20  },
      { nombre_libre:'Vino blanco Albariño (cocina)',  cantidad:0.060, unidad:'l',  coste_unitario:4.80  },
    ]},
    { nombre:'Risotto de boletus con parmesano', categoria:'Primeros', raciones:1, precio_venta:16.00, merma_pct:8, lineas:[
      { nombre_libre:'Arroz bomba (DO Valencia)',      cantidad:0.090, unidad:'kg', coste_unitario:2.10  },
      { nombre_libre:'Boletus edulis (congelado)',     cantidad:0.060, unidad:'kg', coste_unitario:28.00 },
      { nombre_libre:'Queso parmesano (cuña)',         cantidad:0.030, unidad:'kg', coste_unitario:18.50 },
      { nombre_libre:'Caldo de pollo (envase 1L)',     cantidad:0.300, unidad:'l',  coste_unitario:1.20  },
      { nombre_libre:'Mantequilla sin sal (placa)',     cantidad:0.025, unidad:'kg', coste_unitario:8.40  },
      { nombre_libre:'Vino blanco Albariño (cocina)',  cantidad:0.060, unidad:'l',  coste_unitario:4.80  },
    ]},
  ]

  const recetaIds: Record<string, number> = {}
  for (const r of recetas) {
    const res = db.prepare(`INSERT INTO escandallo_receta (user_id,nombre,categoria,raciones,precio_venta,merma_pct,activo) VALUES (?,?,?,?,?,?,1)`)
      .run(uid,r.nombre,r.categoria,r.raciones,r.precio_venta,r.merma_pct)
    recetaIds[r.nombre] = res.lastInsertRowid as number
    for (const l of r.lineas) {
      db.prepare(`INSERT INTO escandallo_lineas (receta_id,user_id,nombre_libre,cantidad,unidad,coste_unitario) VALUES (?,?,?,?,?,?)`)
        .run(recetaIds[r.nombre],uid,l.nombre_libre,l.cantidad,l.unidad,l.coste_unitario)
    }
  }

  // ── VENTAS / PRODUCCIÓN ───────────────────────────────────────────────────
  const produccion = [
    { nombre:'Salmón a la plancha con velouté de espárragos', raciones:34, fecha:dAgo(1) },
    { nombre:'Salmón a la plancha con velouté de espárragos', raciones:28, fecha:dAgo(2) },
    { nombre:'Salmón a la plancha con velouté de espárragos', raciones:22, fecha:dAgo(3) },
    { nombre:'Arroz negro con gambas y alioli de tinta',      raciones:18, fecha:dAgo(1) },
    { nombre:'Arroz negro con gambas y alioli de tinta',      raciones:15, fecha:dAgo(2) },
    { nombre:'Arroz negro con gambas y alioli de tinta',      raciones:20, fecha:dAgo(3) },
    { nombre:'Solomillo al foie con reducción de Rioja',      raciones:12, fecha:dAgo(1) },
    { nombre:'Solomillo al foie con reducción de Rioja',      raciones:9,  fecha:dAgo(2) },
    { nombre:'Crema de tomate asado con albahaca',            raciones:52, fecha:dAgo(1) },
    { nombre:'Crema de tomate asado con albahaca',            raciones:41, fecha:dAgo(2) },
    { nombre:'Crema de tomate asado con albahaca',            raciones:38, fecha:dAgo(3) },
    { nombre:'Pulpo a la gallega con cachelos y pimentón',    raciones:24, fecha:dAgo(1) },
    { nombre:'Pulpo a la gallega con cachelos y pimentón',    raciones:19, fecha:dAgo(2) },
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez', raciones:16, fecha:dAgo(1) },
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez', raciones:14, fecha:dAgo(2) },
    { nombre:'Vieiras con crema de coliflor y caviar',        raciones:8,  fecha:dAgo(1) },
    { nombre:'Tarta de chocolate negro con helado de vainilla', raciones:28, fecha:dAgo(1) },
    { nombre:'Tarta de chocolate negro con helado de vainilla', raciones:24, fecha:dAgo(2) },
    { nombre:'Panna cotta de frambuesa con coulis',           raciones:22, fecha:dAgo(1) },
    { nombre:'Panna cotta de frambuesa con coulis',           raciones:18, fecha:dAgo(2) },
    { nombre:'Tataki de atún rojo con wakame y soja',         raciones:10, fecha:dAgo(1) },
    { nombre:'Risotto de boletus con parmesano',              raciones:15, fecha:dAgo(1) },
    { nombre:'Risotto de boletus con parmesano',              raciones:12, fecha:dAgo(2) },
    { nombre:'Lubina al horno con patatas panaderas',         raciones:18, fecha:dAgo(1) },
    // Histórico semana anterior
    { nombre:'Salmón a la plancha con velouté de espárragos', raciones:30, fecha:dAgo(8) },
    { nombre:'Arroz negro con gambas y alioli de tinta',      raciones:22, fecha:dAgo(8) },
    { nombre:'Crema de tomate asado con albahaca',            raciones:48, fecha:dAgo(8) },
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez', raciones:20, fecha:dAgo(8) },
    { nombre:'Tarta de chocolate negro con helado de vainilla', raciones:32, fecha:dAgo(8) },
  ]
  for (const p of produccion) {
    const rid = recetaIds[p.nombre] ?? null
    db.prepare(`INSERT INTO ventas_produccion (user_id,receta_id,nombre,raciones,fecha) VALUES (?,?,?,?,?)`)
      .run(uid,rid,p.nombre,p.raciones,p.fecha)
  }
}
