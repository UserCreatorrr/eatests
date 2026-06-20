import Database from 'better-sqlite3'

export function seedDemoData(db: Database.Database, uid: string) {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()
  const dAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }
  const mAgo = (n: number, day = 15) => { const d = new Date(today); d.setMonth(d.getMonth() - n); d.setDate(day); return fmt(d) }

  const tables = ['ingredientes','herramientas','proveedores','proveedores_detalle','lista_pedidos',
    'pedidos_compra','albaranes_compra','facturas_compra','albaranes_venta','facturas_venta',
    'escandallo_receta','escandallo_lineas','precio_historial','merma_registro',
    'lineas_albaran_compra','ventas_produccion',
    // Labor + Productivity + Reports
    'locations','empleados','turnos','ventas_franja','targets_productividad','reports_briefs','reports_recipients']
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid) } catch {}
  }

  // ── PROVEEDORES ───────────────────────────────────────────────────────────
  const proveedores = [
    { codi:'PROV001', descr:'Mercabarna Express SL',           descr_type:'Frutas y Verduras',     mail:'pedidos@mercabarnaexpress.com',   phone:'+34645966701', nif:'B12345678', city:'Barcelona',  cp:'08040', contact:'Josep Puig' },
    { codi:'PROV002', descr:'Pescados del Atlántico SA',       descr_type:'Pescadería',             mail:'comercial@pescadosatlantico.es',  phone:'+34645966702', nif:'A87654321', city:'A Coruña',   cp:'15001', contact:'María Fernández' },
    { codi:'PROV003', descr:'Carnes Selectas Martínez',        descr_type:'Carnicería',             mail:'info@carnesmartinez.com',         phone:'+34645966703', nif:'B98765432', city:'Vic',        cp:'08500', contact:'Jordi Martínez' },
    { codi:'PROV004', descr:'Lácteos Frescos del Pirineo',     descr_type:'Lácteos',                mail:'ventas@lacteosfrescos.es',        phone:'+34645966704', nif:'B11223344', city:'Lleida',     cp:'25001', contact:'Anna Solé' },
    { codi:'PROV005', descr:'Aceites García e Hijos',          descr_type:'Aceites y Conservas',    mail:'pedidos@aceitesgarcia.com',       phone:'+34645966705', nif:'B55667788', city:'Jaén',       cp:'23001', contact:'Antonio García' },
    { codi:'PROV006', descr:'Harinera del Norte SL',           descr_type:'Harinas y Cereales',     mail:'info@harineranorte.com',          phone:'+34645966706', nif:'B33445566', city:'Bilbao',     cp:'48001', contact:'Iker Etxeberria' },
    { codi:'PROV007', descr:'Bodegas Rioja Premium',           descr_type:'Bebidas y Vinos',        mail:'export@bodegasrioja.com',         phone:'+34645966707', nif:'A22334455', city:'Logroño',    cp:'26001', contact:'Carlos Moya' },
    { codi:'PROV008', descr:'Distribuciones Roca Alimentación',descr_type:'Distribuidor General',   mail:'pedidos@distrroca.com',           phone:'+34645966708', nif:'B77889900', city:'Sabadell',   cp:'08201', contact:'Pere Roca' },
    { codi:'PROV009', descr:'Verduras del Mediterráneo SL',    descr_type:'Verduras',               mail:'info@verduramediterraneo.es',     phone:'+34645966709', nif:'B44556677', city:'Valencia',   cp:'46001', contact:'Pilar Navarro' },
    { codi:'PROV010', descr:'Mariscos Costa Brava SL',         descr_type:'Marisco',                mail:'pedidos@mariscoscostabrava.com',  phone:'+34645966710', nif:'B99001122', city:'Girona',     cp:'17001', contact:'Miquel Puigdomènech' },
    { codi:'PROV011', descr:'Charcutería Ibérica Extremeña',   descr_type:'Charcutería',            mail:'ventas@ibericaextremena.es',      phone:'+34645966711', nif:'B33221100', city:'Badajoz',    cp:'06001', contact:'Manolo Bravo' },
    { codi:'PROV012', descr:'Pastelería Industrial Balear',    descr_type:'Repostería y Bollería',  mail:'pedidos@pasteleriabalear.com',    phone:'+34645966712', nif:'B55443322', city:'Palma',      cp:'07001', contact:'Catalina Ferrer' },
    { codi:'PROV013', descr:'Cafés y Especias del Mundo',      descr_type:'Especias y Café',        mail:'info@cafesyespecias.com',         phone:'+34645966713', nif:'B66778899', city:'Madrid',     cp:'28001', contact:'Roberto Santos' },
    { codi:'PROV014', descr:'Congelados Premium Norte SA',     descr_type:'Congelados',             mail:'ventas@congeladosnorte.es',       phone:'+34645966714', nif:'A11223344', city:'Santander',  cp:'39001', contact:'Laura González' },
    { codi:'PROV015', descr:'Ecológicos del Valle SL',         descr_type:'Productos Ecológicos',   mail:'pedidos@ecologicosvalle.es',      phone:'+34645966715', nif:'B88990011', city:'Granada',    cp:'18001', contact:'Isabel Ruiz' },
  ]
  const provIds: Record<string, number> = {}
  for (const p of proveedores) {
    const r = db.prepare(`INSERT INTO proveedores (user_id,codi,descr,descr_type,mail,phone,nif,city,cp,contact,defecte,locked,replicated) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,0)`)
      .run(uid,p.codi,p.descr,p.descr_type,p.mail,p.phone,p.nif,p.city,p.cp,p.contact)
    provIds[p.codi] = r.lastInsertRowid as number
  }

  for (const p of [
    { codi:'PROV001', nif:'B12345678', mail_cc:'facturas@mercabarnaexpress.com',  web:'www.mercabarnaexpress.com',   address:'Mercabarna, Nave C-14',            city:'Barcelona',  cp:'08040', comment:'Entrega martes y viernes antes 8h' },
    { codi:'PROV002', nif:'A87654321', mail_cc:'facturas@pescadosatlantico.es',   web:'www.pescadosatlantico.es',    address:'Polígono Ind. O Portiño, nave 8',  city:'A Coruña',   cp:'15011', comment:'Pedido antes de las 18h del día anterior' },
    { codi:'PROV003', nif:'B98765432', mail_cc:'admin@carnesmartinez.com',        web:'www.carnesmartinez.com',      address:'Carrer del Carme, 45',             city:'Vic',        cp:'08500', comment:'Mín. pedido 200 EUR. Envío gratuito >500 EUR' },
    { codi:'PROV004', nif:'B11223344', mail_cc:'contabilidad@lacteosfrescos.es',  web:'www.lacteosfrescos.es',       address:'Ctra. Lleida-Mollerussa, km 12',   city:'Lleida',     cp:'25001', comment:'Factura mensual consolidada' },
    { codi:'PROV005', nif:'B55667788', mail_cc:'facturas@aceitesgarcia.com',      web:'www.aceitesgarcia.com',       address:'Polígono El Olivar, nave 3',       city:'Jaén',       cp:'23001', comment:'TRF 60 días fin de mes' },
    { codi:'PROV006', nif:'B33445566', mail_cc:'admin@harineranorte.com',         web:'www.harineranorte.com',       address:'Barrio Industrial Ugarte, 12',     city:'Bilbao',     cp:'48001', comment:'Pedido mínimo 5 sacos 25kg' },
    { codi:'PROV007', nif:'A22334455', mail_cc:'cuentas@bodegasrioja.com',        web:'www.bodegasriojapremium.com', address:'Ctra. Nacional 232, km 18',        city:'Logroño',    cp:'26001', comment:'Comercial: Carlos Moya 636 100 200' },
    { codi:'PROV008', nif:'B77889900', mail_cc:'pedidos@distrroca.com',           web:'www.distribuciones-roca.es',  address:'Polígono Can Roqueta, nave 22',    city:'Sabadell',   cp:'08201', comment:'Distribuidor general. Entrega 24h' },
    { codi:'PROV009', nif:'B44556677', mail_cc:'info@verduramediterraneo.es',     web:'www.verduramediterraneo.es',  address:'Mercat Central, puesto 18-B',      city:'Valencia',   cp:'46001', comment:'Solo entrega de lunes a viernes' },
    { codi:'PROV010', nif:'B99001122', mail_cc:'facturas@mariscoscostabrava.com', web:'www.mariscoscostabrava.com',  address:'Port de Palamós, moll 4',          city:'Girona',     cp:'17230', comment:'Disponibilidad sujeta a temporada' },
    { codi:'PROV011', nif:'B33221100', mail_cc:'ventas@ibericaextremena.es',      web:'www.ibericaextremena.es',     address:'Polígono El Prado, nave 7',        city:'Badajoz',    cp:'06001', comment:'Pago a 60 días. Mín. pedido 300 EUR' },
    { codi:'PROV012', nif:'B55443322', mail_cc:'admin@pasteleriabalear.com',      web:'www.pasteleriabalear.com',    address:'Camí de Son Fuster, 8',            city:'Palma',      cp:'07007', comment:'Pedido antes del miércoles para entrega viernes' },
    { codi:'PROV013', nif:'B66778899', mail_cc:'facturas@cafesyespecias.com',     web:'www.cafesyespecias.com',      address:'Calle Gran Vía, 42, piso 3',       city:'Madrid',     cp:'28013', comment:'Pedido trimestral. Envío por mensajería' },
    { codi:'PROV014', nif:'A11223344', mail_cc:'cuentas@congeladosnorte.es',      web:'www.congeladosnorte.es',      address:'Polígono Área 13, nave 8',         city:'Santander',  cp:'39011', comment:'Cadena de frío garantizada' },
    { codi:'PROV015', nif:'B88990011', mail_cc:'eco@ecologicosvalle.es',          web:'www.ecologicosvalle.es',      address:'Finca El Olivo, Ctra. A-44, km 3', city:'Granada',   cp:'18001', comment:'Certificado ecológico ES-ECO-020-AN' },
  ]) {
    db.prepare(`INSERT INTO proveedores_detalle (user_id,codi,descr,nif,comment,mail_cc,web,creditor,address,city,cp) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uid,p.codi,proveedores.find(x=>x.codi===p.codi)!.descr,p.nif,p.comment,p.mail_cc,p.web,1,p.address,p.city,p.cp)
  }

  // ── INGREDIENTES ──────────────────────────────────────────────────────────
  const ingredientes = [
    // Pescados
    { codi:'ING001', descr:'Salmón fresco (lomo)',          type:'Pescado',     unit:'kg', cost:15.20 },
    { codi:'ING002', descr:'Merluza fresca (filete)',       type:'Pescado',     unit:'kg', cost:9.80  },
    { codi:'ING003', descr:'Lubina fresca entera',          type:'Pescado',     unit:'kg', cost:12.60 },
    { codi:'ING004', descr:'Bacalao desalado',              type:'Pescado',     unit:'kg', cost:11.60 },
    { codi:'ING005', descr:'Atún rojo (sashimi)',           type:'Pescado',     unit:'kg', cost:44.00 },
    { codi:'ING006', descr:'Dorada fresca entera',          type:'Pescado',     unit:'kg', cost:10.40 },
    { codi:'ING007', descr:'Rodaballo fresco',              type:'Pescado',     unit:'kg', cost:24.00 },
    { codi:'ING008', descr:'Besugo fresco',                 type:'Pescado',     unit:'kg', cost:19.50 },
    // Mariscos
    { codi:'ING009', descr:'Gambas rojas (16/20)',          type:'Marisco',     unit:'kg', cost:31.00 },
    { codi:'ING010', descr:'Pulpo cocido (tentáculos)',     type:'Marisco',     unit:'kg', cost:12.40 },
    { codi:'ING011', descr:'Almejas frescas',               type:'Marisco',     unit:'kg', cost:14.80 },
    { codi:'ING012', descr:'Langostinos tigre',             type:'Marisco',     unit:'kg', cost:34.00 },
    { codi:'ING013', descr:'Mejillones frescos',            type:'Marisco',     unit:'kg', cost:3.20  },
    { codi:'ING014', descr:'Vieiras (concha)',              type:'Marisco',     unit:'ud', cost:3.20  },
    { codi:'ING015', descr:'Cigala mediana (fresca)',       type:'Marisco',     unit:'ud', cost:6.50  },
    { codi:'ING016', descr:'Bogavante gallego',             type:'Marisco',     unit:'kg', cost:58.00 },
    // Carnes
    { codi:'ING017', descr:'Pechuga de pollo (filetes)',    type:'Carne',       unit:'kg', cost:6.20  },
    { codi:'ING018', descr:'Muslo de pollo (deshuesado)',   type:'Carne',       unit:'kg', cost:4.80  },
    { codi:'ING019', descr:'Solomillo de ternera',          type:'Carne',       unit:'kg', cost:34.00 },
    { codi:'ING020', descr:'Chuletón de buey madurado',    type:'Carne',       unit:'kg', cost:62.00 },
    { codi:'ING021', descr:'Costilla de cerdo ibérico',    type:'Carne',       unit:'kg', cost:8.60  },
    { codi:'ING022', descr:'Carrillera de cerdo',           type:'Carne',       unit:'kg', cost:7.40  },
    { codi:'ING023', descr:'Muslo de pato confitado',       type:'Carne',       unit:'ud', cost:4.80  },
    { codi:'ING024', descr:'Cordero lechal (pierna)',       type:'Carne',       unit:'kg', cost:17.50 },
    { codi:'ING025', descr:'Ternera picada (80/20)',        type:'Carne',       unit:'kg', cost:9.20  },
    // Charcutería
    { codi:'ING026', descr:'Foie gras mi-cuit',             type:'Charcutería', unit:'kg', cost:72.00 },
    { codi:'ING027', descr:'Jamón ibérico de bellota',      type:'Charcutería', unit:'kg', cost:98.00 },
    { codi:'ING028', descr:'Chorizo ibérico curado',        type:'Charcutería', unit:'kg', cost:22.00 },
    { codi:'ING029', descr:'Panceta ahumada (lonchas)',     type:'Charcutería', unit:'kg', cost:11.50 },
    // Verduras
    { codi:'ING030', descr:'Tomate rama madurado',          type:'Verdura',     unit:'kg', cost:2.10  },
    { codi:'ING031', descr:'Tomate cherry mix',             type:'Verdura',     unit:'kg', cost:3.80  },
    { codi:'ING032', descr:'Pimiento rojo extra',           type:'Verdura',     unit:'kg', cost:1.40  },
    { codi:'ING033', descr:'Pimiento verde italiano',       type:'Verdura',     unit:'kg', cost:1.20  },
    { codi:'ING034', descr:'Cebolla blanca grande',         type:'Verdura',     unit:'kg', cost:0.65  },
    { codi:'ING035', descr:'Cebolla morada',                type:'Verdura',     unit:'kg', cost:0.90  },
    { codi:'ING036', descr:'Ajo morado fresco',             type:'Verdura',     unit:'kg', cost:3.60  },
    { codi:'ING037', descr:'Patata agria (Monalisa)',       type:'Verdura',     unit:'kg', cost:0.55  },
    { codi:'ING038', descr:'Espárrago verde (calibre 16)',  type:'Verdura',     unit:'kg', cost:5.20  },
    { codi:'ING039', descr:'Espinaca baby (bolsa)',         type:'Verdura',     unit:'kg', cost:5.60  },
    { codi:'ING040', descr:'Berenjena (extra)',             type:'Verdura',     unit:'kg', cost:1.10  },
    { codi:'ING041', descr:'Calabacín verde',               type:'Verdura',     unit:'kg', cost:0.90  },
    { codi:'ING042', descr:'Zanahoria (pelada)',            type:'Verdura',     unit:'kg', cost:0.75  },
    { codi:'ING043', descr:'Puerro fresco',                 type:'Verdura',     unit:'kg', cost:1.60  },
    { codi:'ING044', descr:'Alcachofa fresca',              type:'Verdura',     unit:'ud', cost:0.90  },
    { codi:'ING045', descr:'Remolacha cocida (vac.)',       type:'Verdura',     unit:'kg', cost:2.40  },
    // Hongos
    { codi:'ING046', descr:'Champiñón laminado',            type:'Hongo',       unit:'kg', cost:2.40  },
    { codi:'ING047', descr:'Seta shiitake fresca',          type:'Hongo',       unit:'kg', cost:13.50 },
    { codi:'ING048', descr:'Boletus edulis (congelado)',    type:'Hongo',       unit:'kg', cost:30.00 },
    { codi:'ING049', descr:'Trufa negra rallada (tarro)',   type:'Hongo',       unit:'g',  cost:0.90  },
    { codi:'ING050', descr:'Rúcula fresca (bolsa)',         type:'Hongo',       unit:'kg', cost:6.80  },
    // Lácteos
    { codi:'ING051', descr:'Nata líquida 35% MG',          type:'Lácteo',      unit:'l',  cost:2.60  },
    { codi:'ING052', descr:'Mantequilla sin sal (placa)',   type:'Lácteo',      unit:'kg', cost:9.20  },
    { codi:'ING053', descr:'Queso parmesano (cuña)',        type:'Lácteo',      unit:'kg', cost:19.50 },
    { codi:'ING054', descr:'Queso manchego curado',         type:'Lácteo',      unit:'kg', cost:14.20 },
    { codi:'ING055', descr:'Queso brie francés',            type:'Lácteo',      unit:'kg', cost:17.50 },
    { codi:'ING056', descr:'Queso de cabra rulo',           type:'Lácteo',      unit:'ud', cost:3.40  },
    { codi:'ING057', descr:'Huevos camperos L (docena)',    type:'Lácteo',      unit:'ud', cost:0.30  },
    { codi:'ING058', descr:'Leche entera (brick)',          type:'Lácteo',      unit:'l',  cost:0.90  },
    { codi:'ING059', descr:'Yogur griego (bote 1kg)',       type:'Lácteo',      unit:'kg', cost:3.60  },
    // Aceites y conservas
    { codi:'ING060', descr:'Aceite de oliva virgen extra',  type:'Aceite',      unit:'l',  cost:7.20  },
    { codi:'ING061', descr:'Aceite de girasol refinado',    type:'Aceite',      unit:'l',  cost:1.50  },
    { codi:'ING062', descr:'Vinagre de Módena IGP',         type:'Conserva',    unit:'l',  cost:8.80  },
    { codi:'ING063', descr:'Tomate triturado (lata 3kg)',   type:'Conserva',    unit:'kg', cost:1.60  },
    { codi:'ING064', descr:'Anchoas en aceite (lata)',      type:'Conserva',    unit:'ud', cost:5.20  },
    // Harinas y cereales
    { codi:'ING065', descr:'Harina de trigo T55',           type:'Harina',      unit:'kg', cost:0.92  },
    { codi:'ING066', descr:'Harina de fuerza W360',         type:'Harina',      unit:'kg', cost:1.30  },
    { codi:'ING067', descr:'Arroz bomba (DO Valencia)',     type:'Cereal',      unit:'kg', cost:2.20  },
    { codi:'ING068', descr:'Pasta fresca tagliatelle',      type:'Pasta',       unit:'kg', cost:3.60  },
    { codi:'ING069', descr:'Pan de molde brioche',          type:'Panadería',   unit:'ud', cost:1.30  },
    { codi:'ING070', descr:'Pan de cristal (barra)',        type:'Panadería',   unit:'ud', cost:1.90  },
    // Caldos
    { codi:'ING071', descr:'Caldo de pollo (envase 1L)',    type:'Caldo',       unit:'l',  cost:1.30  },
    { codi:'ING072', descr:'Fondo oscuro de ternera',       type:'Caldo',       unit:'l',  cost:3.80  },
    { codi:'ING073', descr:'Fumet de pescado',              type:'Caldo',       unit:'l',  cost:2.60  },
    // Vinos y licores
    { codi:'ING074', descr:'Vino blanco Albariño (cocina)', type:'Vino',        unit:'l',  cost:5.20  },
    { codi:'ING075', descr:'Vino tinto Rioja (cocina)',     type:'Vino',        unit:'l',  cost:3.80  },
    { codi:'ING076', descr:'Brandy de Jerez',               type:'Licor',       unit:'l',  cost:12.00 },
    // Azúcares y repostería
    { codi:'ING077', descr:'Azúcar blanco refinado',        type:'Azúcar',      unit:'kg', cost:0.98  },
    { codi:'ING078', descr:'Azúcar moreno de caña',         type:'Azúcar',      unit:'kg', cost:1.50  },
    { codi:'ING079', descr:'Chocolate negro 70% (pastilla)',type:'Repostería',  unit:'kg', cost:12.00 },
    { codi:'ING080', descr:'Chocolate blanco (pastilla)',   type:'Repostería',  unit:'kg', cost:10.50 },
    // Frutas
    { codi:'ING081', descr:'Fresas frescas (bandeja 500g)', type:'Fruta',       unit:'kg', cost:5.50  },
    { codi:'ING082', descr:'Frambuesa fresca',              type:'Fruta',       unit:'kg', cost:19.50 },
    { codi:'ING083', descr:'Mango (extra)',                 type:'Fruta',       unit:'kg', cost:4.20  },
    { codi:'ING084', descr:'Limón (malla 5kg)',             type:'Fruta',       unit:'kg', cost:1.50  },
    { codi:'ING085', descr:'Naranja zumo (clase A)',        type:'Fruta',       unit:'kg', cost:0.85  },
    // Especias y hierbas
    { codi:'ING086', descr:'Sal marina fina (saco 25kg)',   type:'Condimento',  unit:'kg', cost:0.42  },
    { codi:'ING087', descr:'Pimienta negra molida',         type:'Especia',     unit:'kg', cost:13.50 },
    { codi:'ING088', descr:'Pimentón ahumado La Vera',      type:'Especia',     unit:'kg', cost:9.20  },
    { codi:'ING089', descr:'Azafrán (hebras, 1g)',          type:'Especia',     unit:'g',  cost:0.30  },
    { codi:'ING090', descr:'Romero fresco (manojo)',        type:'Hierba',      unit:'ud', cost:0.65  },
    { codi:'ING091', descr:'Tomillo fresco (manojo)',       type:'Hierba',      unit:'ud', cost:0.60  },
    { codi:'ING092', descr:'Albahaca fresca (maceta)',      type:'Hierba',      unit:'ud', cost:1.90  },
  ]
  // Almacén operativo por familia de ingrediente
  const almacenPorTipo: Record<string, string> = {
    'Pescado': 'Nevera', 'Marisco': 'Nevera', 'Carne': 'Nevera', 'Charcutería': 'Nevera',
    'Lácteo': 'Nevera', 'Verdura': 'Nevera', 'Fruta': 'Nevera', 'Hierba': 'Nevera', 'Hongo': 'Nevera', 'Huevo': 'Nevera',
    'Congelado': 'Congelador',
    'Seco': 'Seco / Despensa', 'Harina': 'Seco / Despensa', 'Cereal': 'Seco / Despensa', 'Legumbre': 'Seco / Despensa',
    'Aceite': 'Seco / Despensa', 'Conserva': 'Seco / Despensa', 'Especia': 'Seco / Despensa', 'Pasta': 'Seco / Despensa',
    'Bebida': 'Bodega', 'Vino': 'Bodega', 'Licor': 'Bodega',
    'Repostería': 'Seco / Despensa', 'Pan': 'Seco / Despensa',
  }
  for (const i of ingredientes) {
    const alm = almacenPorTipo[i.type] || (i.unit === 'l' ? 'Bodega' : 'Seco / Despensa')
    db.prepare(`INSERT INTO ingredientes (user_id,codi,descr,type,unit,cost,has_data,almacen_principal) VALUES (?,?,?,?,?,?,1,?)`)
      .run(uid,i.codi,i.descr,i.type,i.unit,i.cost,alm)
  }

  const ingProvMap: Record<string, string> = {
    'ING001':'PROV002','ING002':'PROV002','ING003':'PROV002','ING004':'PROV002',
    'ING005':'PROV002','ING006':'PROV002','ING007':'PROV002','ING008':'PROV002',
    'ING009':'PROV010','ING010':'PROV010','ING011':'PROV010','ING012':'PROV010',
    'ING013':'PROV010','ING014':'PROV010','ING015':'PROV010','ING016':'PROV010',
    'ING017':'PROV003','ING018':'PROV003','ING019':'PROV003','ING020':'PROV003',
    'ING021':'PROV003','ING022':'PROV003','ING023':'PROV003','ING024':'PROV003','ING025':'PROV003',
    'ING026':'PROV011','ING027':'PROV011','ING028':'PROV011','ING029':'PROV011',
    'ING030':'PROV001','ING031':'PROV001','ING032':'PROV001','ING033':'PROV001',
    'ING034':'PROV001','ING035':'PROV001','ING036':'PROV001','ING037':'PROV001','ING038':'PROV001',
    'ING039':'PROV009','ING040':'PROV009','ING041':'PROV009','ING042':'PROV009',
    'ING043':'PROV009','ING044':'PROV009','ING045':'PROV009',
    'ING046':'PROV015','ING047':'PROV015','ING048':'PROV015','ING049':'PROV015','ING050':'PROV015',
    'ING051':'PROV004','ING052':'PROV004','ING053':'PROV004','ING054':'PROV004',
    'ING055':'PROV004','ING056':'PROV004','ING057':'PROV004','ING058':'PROV004','ING059':'PROV004',
    'ING060':'PROV005','ING061':'PROV005','ING062':'PROV005','ING063':'PROV005','ING064':'PROV005',
    'ING065':'PROV006','ING066':'PROV006','ING067':'PROV006','ING068':'PROV006',
    'ING069':'PROV012','ING070':'PROV012',
    'ING071':'PROV008','ING072':'PROV008','ING073':'PROV008',
    'ING074':'PROV007','ING075':'PROV007','ING076':'PROV007',
    'ING077':'PROV008','ING078':'PROV008',
    'ING079':'PROV012','ING080':'PROV012',
    'ING081':'PROV001','ING082':'PROV001','ING083':'PROV001','ING084':'PROV001','ING085':'PROV001',
    'ING086':'PROV013','ING087':'PROV013','ING088':'PROV013','ING089':'PROV013',
    'ING090':'PROV009','ING091':'PROV009','ING092':'PROV009',
  }
  for (const [codi, provCodi] of Object.entries(ingProvMap)) {
    const provId = provIds[provCodi]
    const provDescr = proveedores.find(p => p.codi === provCodi)?.descr || ''
    if (provId) db.prepare(`UPDATE ingredientes SET proveedor_id=?,proveedor_nombre=? WHERE user_id=? AND codi=?`).run(provId,provDescr,uid,codi)
  }

  // ── PEDIDOS COMPRA ────────────────────────────────────────────────────────
  const pedidos = [
    // Esta semana (últimos 7 días)
    { num:`PED-${dAgo(0).replace(/-/g,'')}-001`, vendor:'Pescados del Atlántico SA',       date_order:dAgo(0), date_reception:dAgo(0),  sent_by:'email',    total:724.80 },
    { num:`PED-${dAgo(1).replace(/-/g,'')}-001`, vendor:'Mercabarna Express SL',           date_order:dAgo(1), date_reception:dAgo(1),  sent_by:'whatsapp', total:368.40 },
    { num:`PED-${dAgo(1).replace(/-/g,'')}-002`, vendor:'Mariscos Costa Brava SL',         date_order:dAgo(1), date_reception:dAgo(0),  sent_by:'email',    total:612.50 },
    { num:`PED-${dAgo(2).replace(/-/g,'')}-001`, vendor:'Carnes Selectas Martínez',        date_order:dAgo(2), date_reception:dAgo(1),  sent_by:'email',    total:548.20 },
    { num:`PED-${dAgo(3).replace(/-/g,'')}-001`, vendor:'Lácteos Frescos del Pirineo',     date_order:dAgo(3), date_reception:dAgo(2),  sent_by:'email',    total:214.60 },
    { num:`PED-${dAgo(4).replace(/-/g,'')}-001`, vendor:'Aceites García e Hijos',          date_order:dAgo(4), date_reception:dAgo(3),  sent_by:'email',    total:486.00 },
    { num:`PED-${dAgo(5).replace(/-/g,'')}-001`, vendor:'Harinera del Norte SL',           date_order:dAgo(5), date_reception:dAgo(4),  sent_by:'email',    total:163.50 },
    { num:`PED-${dAgo(6).replace(/-/g,'')}-001`, vendor:'Charcutería Ibérica Extremeña',   date_order:dAgo(6), date_reception:dAgo(5),  sent_by:'email',    total:890.00 },
    // Semana anterior (días 8-14)
    { num:`PED-${dAgo(8).replace(/-/g,'')}-001`,  vendor:'Mercabarna Express SL',          date_order:dAgo(8),  date_reception:dAgo(7),  sent_by:'whatsapp', total:312.80 },
    { num:`PED-${dAgo(9).replace(/-/g,'')}-001`,  vendor:'Pescados del Atlántico SA',      date_order:dAgo(9),  date_reception:dAgo(8),  sent_by:'email',    total:598.40 },
    { num:`PED-${dAgo(10).replace(/-/g,'')}-001`, vendor:'Bodegas Rioja Premium',          date_order:dAgo(10), date_reception:dAgo(9),  sent_by:'email',    total:940.00 },
    { num:`PED-${dAgo(11).replace(/-/g,'')}-001`, vendor:'Carnes Selectas Martínez',       date_order:dAgo(11), date_reception:dAgo(10), sent_by:'email',    total:476.60 },
    { num:`PED-${dAgo(12).replace(/-/g,'')}-001`, vendor:'Distribuciones Roca Alimentación',date_order:dAgo(12),date_reception:dAgo(11), sent_by:'email',    total:642.30 },
    { num:`PED-${dAgo(13).replace(/-/g,'')}-001`, vendor:'Mariscos Costa Brava SL',        date_order:dAgo(13), date_reception:dAgo(12), sent_by:'whatsapp', total:534.80 },
    { num:`PED-${dAgo(14).replace(/-/g,'')}-001`, vendor:'Verduras del Mediterráneo SL',   date_order:dAgo(14), date_reception:dAgo(13), sent_by:'whatsapp', total:187.60 },
    // Mes anterior
    { num:`PED-${mAgo(1,22).replace(/-/g,'')}-001`, vendor:'Mercabarna Express SL',        date_order:mAgo(1,22), date_reception:mAgo(1,23), sent_by:'email', total:318.40 },
    { num:`PED-${mAgo(1,20).replace(/-/g,'')}-001`, vendor:'Carnes Selectas Martínez',     date_order:mAgo(1,20), date_reception:mAgo(1,21), sent_by:'email', total:612.80 },
    { num:`PED-${mAgo(1,18).replace(/-/g,'')}-001`, vendor:'Pescados del Atlántico SA',    date_order:mAgo(1,18), date_reception:mAgo(1,19), sent_by:'email', total:523.10 },
    { num:`PED-${mAgo(1,15).replace(/-/g,'')}-001`, vendor:'Aceites García e Hijos',       date_order:mAgo(1,15), date_reception:mAgo(1,16), sent_by:'email', total:310.00 },
    { num:`PED-${mAgo(1,12).replace(/-/g,'')}-001`, vendor:'Bodegas Rioja Premium',        date_order:mAgo(1,12), date_reception:mAgo(1,13), sent_by:'email', total:760.00 },
    { num:`PED-${mAgo(1,8).replace(/-/g,'')}-001`,  vendor:'Lácteos Frescos del Pirineo',  date_order:mAgo(1,8),  date_reception:mAgo(1,9),  sent_by:'email', total:245.60 },
    { num:`PED-${mAgo(1,5).replace(/-/g,'')}-001`,  vendor:'Mariscos Costa Brava SL',      date_order:mAgo(1,5),  date_reception:mAgo(1,6),  sent_by:'whatsapp', total:612.80 },
    { num:`PED-${mAgo(1,3).replace(/-/g,'')}-001`,  vendor:'Charcutería Ibérica Extremeña',date_order:mAgo(1,3),  date_reception:mAgo(1,4),  sent_by:'email', total:920.00 },
    // 2 meses atrás
    { num:`PED-${mAgo(2,22).replace(/-/g,'')}-001`, vendor:'Mercabarna Express SL',        date_order:mAgo(2,22), date_reception:mAgo(2,23), sent_by:'email', total:298.60 },
    { num:`PED-${mAgo(2,18).replace(/-/g,'')}-001`, vendor:'Carnes Selectas Martínez',     date_order:mAgo(2,18), date_reception:mAgo(2,19), sent_by:'email', total:580.00 },
    { num:`PED-${mAgo(2,12).replace(/-/g,'')}-001`, vendor:'Bodegas Rioja Premium',        date_order:mAgo(2,12), date_reception:mAgo(2,13), sent_by:'email', total:840.00 },
    { num:`PED-${mAgo(2,10).replace(/-/g,'')}-001`, vendor:'Pescados del Atlántico SA',    date_order:mAgo(2,10), date_reception:mAgo(2,11), sent_by:'email', total:490.80 },
    { num:`PED-${mAgo(3,15).replace(/-/g,'')}-001`, vendor:'Congelados Premium Norte SA',  date_order:mAgo(3,15), date_reception:mAgo(3,16), sent_by:'email', total:1240.00 },
    { num:`PED-${mAgo(4,15).replace(/-/g,'')}-001`, vendor:'Charcutería Ibérica Extremeña',date_order:mAgo(4,15), date_reception:mAgo(4,16), sent_by:'email', total:1580.00 },
    { num:`PED-${mAgo(4,10).replace(/-/g,'')}-001`, vendor:'Bodegas Rioja Premium',        date_order:mAgo(4,10), date_reception:mAgo(4,11), sent_by:'email', total:2240.00 },
  ]
  for (const p of pedidos) {
    db.prepare(`INSERT INTO pedidos_compra (user_id,num_order,vendor,date_order,date_reception,sent_by,total) VALUES (?,?,?,?,?,?,?)`)
      .run(uid,p.num,p.vendor,p.date_order,p.date_reception,p.sent_by,p.total)
  }

  // ── LISTA PEDIDOS ─────────────────────────────────────────────────────────
  const yr = today.getFullYear(), mo = today.getMonth()+1
  for (const lp of [
    { descr:'Pedido semanal verduras — Mercabarna',   year:yr, month:mo,   pending_send:0, pending_receive:0 },
    { descr:'Pedido pescado semana — Atlántico',      year:yr, month:mo,   pending_send:0, pending_receive:1 },
    { descr:'Pedido carnes — Martínez',               year:yr, month:mo,   pending_send:1, pending_receive:0 },
    { descr:'Pedido lácteos quincenal — Pirineo',     year:yr, month:mo,   pending_send:1, pending_receive:1 },
    { descr:'Pedido vinos mensual — Rioja Premium',   year:yr, month:mo,   pending_send:0, pending_receive:0 },
    { descr:'Pedido mariscos — Costa Brava',          year:yr, month:mo,   pending_send:1, pending_receive:0 },
    { descr:'Pedido charcutería ibérica',             year:yr, month:mo-1, pending_send:0, pending_receive:0 },
    { descr:'Pedido especias trimestral',             year:yr, month:mo-1, pending_send:0, pending_receive:0 },
  ]) {
    db.prepare(`INSERT INTO lista_pedidos (user_id,descr,year,month,pending_send,pending_receive,locked,replicated) VALUES (?,?,?,?,?,?,0,0)`)
      .run(uid,lp.descr,lp.year,lp.month,lp.pending_send,lp.pending_receive)
  }

  // ── VENDOR INFO ───────────────────────────────────────────────────────────
  const vInfo: Record<string, { codi: string; nif: string }> = {
    'Mercabarna Express SL':           { codi:'PROV001', nif:'B12345678' },
    'Pescados del Atlántico SA':       { codi:'PROV002', nif:'A87654321' },
    'Carnes Selectas Martínez':        { codi:'PROV003', nif:'B98765432' },
    'Lácteos Frescos del Pirineo':     { codi:'PROV004', nif:'B11223344' },
    'Aceites García e Hijos':          { codi:'PROV005', nif:'B55667788' },
    'Harinera del Norte SL':           { codi:'PROV006', nif:'B33445566' },
    'Bodegas Rioja Premium':           { codi:'PROV007', nif:'A22334455' },
    'Distribuciones Roca Alimentación':{ codi:'PROV008', nif:'B77889900' },
    'Distribuciones Roca':             { codi:'PROV008', nif:'B77889900' },
    'Verduras del Mediterráneo SL':    { codi:'PROV009', nif:'B44556677' },
    'Mariscos Costa Brava SL':         { codi:'PROV010', nif:'B99001122' },
    'Charcutería Ibérica Extremeña':   { codi:'PROV011', nif:'B33221100' },
    'Charcutería Ibérica':             { codi:'PROV011', nif:'B33221100' },
    'Ecológicos del Valle SL':         { codi:'PROV015', nif:'B88990011' },
    'Congelados Premium Norte SA':     { codi:'PROV014', nif:'A11223344' },
    'Cafés y Especias del Mundo':      { codi:'PROV013', nif:'B66778899' },
  }

  // ── ALBARANES COMPRA ──────────────────────────────────────────────────────
  const albaranes = [
    // Esta semana
    { delivery_num:`ALB-${dAgo(0).replace(/-/g,'')}-001`, vendor:'Pescados del Atlántico SA',      date_delivery:dAgo(0),  received_by:'Chef',  base:598.18, taxes:125.62, total:723.80 },
    { delivery_num:`ALB-${dAgo(1).replace(/-/g,'')}-001`, vendor:'Mercabarna Express SL',          date_delivery:dAgo(1),  received_by:'Pablo', base:304.46, taxes:63.94,  total:368.40 },
    { delivery_num:`ALB-${dAgo(1).replace(/-/g,'')}-002`, vendor:'Mariscos Costa Brava SL',        date_delivery:dAgo(1),  received_by:'Chef',  base:506.20, taxes:106.30, total:612.50 },
    { delivery_num:`ALB-${dAgo(2).replace(/-/g,'')}-001`, vendor:'Carnes Selectas Martínez',       date_delivery:dAgo(2),  received_by:'Pablo', base:453.06, taxes:95.14,  total:548.20 },
    { delivery_num:`ALB-${dAgo(3).replace(/-/g,'')}-001`, vendor:'Lácteos Frescos del Pirineo',    date_delivery:dAgo(3),  received_by:'Pablo', base:177.36, taxes:37.24,  total:214.60 },
    { delivery_num:`ALB-${dAgo(4).replace(/-/g,'')}-001`, vendor:'Aceites García e Hijos',         date_delivery:dAgo(4),  received_by:'Pablo', base:401.65, taxes:84.35,  total:486.00 },
    { delivery_num:`ALB-${dAgo(5).replace(/-/g,'')}-001`, vendor:'Harinera del Norte SL',          date_delivery:dAgo(5),  received_by:'Pablo', base:135.12, taxes:28.38,  total:163.50 },
    { delivery_num:`ALB-${dAgo(6).replace(/-/g,'')}-001`, vendor:'Charcutería Ibérica Extremeña',  date_delivery:dAgo(6),  received_by:'Pablo', base:735.54, taxes:154.46, total:890.00 },
    // Semana anterior
    { delivery_num:`ALB-${dAgo(8).replace(/-/g,'')}-001`,  vendor:'Mercabarna Express SL',         date_delivery:dAgo(8),  received_by:'Chef',  base:258.51, taxes:54.29,  total:312.80 },
    { delivery_num:`ALB-${dAgo(9).replace(/-/g,'')}-001`,  vendor:'Pescados del Atlántico SA',     date_delivery:dAgo(9),  received_by:'Chef',  base:494.55, taxes:103.85, total:598.40 },
    { delivery_num:`ALB-${dAgo(10).replace(/-/g,'')}-001`, vendor:'Bodegas Rioja Premium',         date_delivery:dAgo(10), received_by:'Pablo', base:776.86, taxes:163.14, total:940.00 },
    { delivery_num:`ALB-${dAgo(12).replace(/-/g,'')}-001`, vendor:'Distribuciones Roca',           date_delivery:dAgo(12), received_by:'Pablo', base:530.83, taxes:111.47, total:642.30 },
    { delivery_num:`ALB-${dAgo(13).replace(/-/g,'')}-001`, vendor:'Mariscos Costa Brava SL',       date_delivery:dAgo(13), received_by:'Chef',  base:442.31, taxes:92.89,  total:534.80 },
    // Mes anterior
    { delivery_num:`ALB-${mAgo(1,20).replace(/-/g,'')}-001`, vendor:'Carnes Selectas Martínez',    date_delivery:mAgo(1,20), received_by:'Chef',  base:506.45, taxes:106.35, total:612.80 },
    { delivery_num:`ALB-${mAgo(1,18).replace(/-/g,'')}-001`, vendor:'Pescados del Atlántico SA',   date_delivery:mAgo(1,18), received_by:'Pablo', base:432.31, taxes:90.85,  total:523.10 },
    { delivery_num:`ALB-${mAgo(1,15).replace(/-/g,'')}-001`, vendor:'Mariscos Costa Brava SL',     date_delivery:mAgo(1,15), received_by:'Chef',  base:506.45, taxes:106.35, total:612.80 },
  ]
  for (const a of albaranes) {
    const v = vInfo[a.vendor] ?? { codi: null, nif: null }
    db.prepare(`INSERT INTO albaranes_compra (user_id,delivery_num,vendor,code_vendor,nif,delivery_for,date_delivery,date_sent,sent_by,received_by,base,taxes,total,cost_type,vendor_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uid,a.delivery_num,a.vendor,v.codi,v.nif,'Cocina',a.date_delivery,a.date_delivery,'email',a.received_by,a.base,a.taxes,a.total,'Variable',proveedores.find(p=>p.codi===v.codi)?.descr_type??null)
  }

  // ── FACTURAS COMPRA ───────────────────────────────────────────────────────
  const facturas = [
    // Vencidas — urgente pagar YA
    { num:'FAC-2026-0102', vendor:'Mercabarna Express SL',        payment:'TRF30', date_invoice:dAgo(38), date_due:dAgo(8),   base:596.20,  taxes:125.20, total:721.40,  paid:0, validated:1, comment:'Verduras y frutas semanas 17-18' },
    { num:'FAC-2026-0101', vendor:'Pescados del Atlántico SA',    payment:'TRF30', date_invoice:dAgo(35), date_due:dAgo(12),  base:1122.96, taxes:235.82, total:1358.78, paid:0, validated:1, comment:'Pedidos semana 16' },
    { num:'FAC-2026-0100', vendor:'Mariscos Costa Brava SL',      payment:'TRF30', date_invoice:dAgo(32), date_due:dAgo(5),   base:494.51,  taxes:103.85, total:598.36,  paid:0, validated:1, comment:null },
    { num:'FAC-2026-0099', vendor:'Charcutería Ibérica Extremeña',payment:'TRF60', date_invoice:dAgo(42), date_due:dAgo(18),  base:735.54,  taxes:154.46, total:890.00,  paid:0, validated:1, comment:'Ibéricos temporada primavera' },
    { num:'FAC-2026-0098', vendor:'Distribuciones Roca',          payment:'TRF60', date_invoice:dAgo(48), date_due:dAgo(22),  base:530.83,  taxes:111.47, total:642.30,  paid:0, validated:0, comment:'Pendiente revisar albarán 0399' },
    // Vencen en menos de 5 días
    { num:'FAC-2026-0097', vendor:'Carnes Selectas Martínez',     payment:'TRF30', date_invoice:dAgo(25), date_due:dAgo(-3),  base:453.06,  taxes:95.14,  total:548.20,  paid:0, validated:1, comment:null },
    { num:'FAC-2026-0096', vendor:'Aceites García e Hijos',       payment:'TRF60', date_invoice:dAgo(22), date_due:dAgo(-4),  base:401.65,  taxes:84.35,  total:486.00,  paid:0, validated:1, comment:'Aceites AOVE campaña 2025-26' },
    // Pendientes (vencen en 10-30 días)
    { num:'FAC-2026-0095', vendor:'Lácteos Frescos del Pirineo',  payment:'TRF30', date_invoice:dAgo(18), date_due:dAgo(-12), base:177.36,  taxes:37.24,  total:214.60,  paid:0, validated:1, comment:null },
    { num:'FAC-2026-0094', vendor:'Harinera del Norte SL',        payment:'TRF60', date_invoice:dAgo(15), date_due:dAgo(-15), base:135.12,  taxes:28.38,  total:163.50,  paid:0, validated:1, comment:null },
    { num:'FAC-2026-0093', vendor:'Ecológicos del Valle SL',      payment:'TRF30', date_invoice:dAgo(12), date_due:dAgo(-18), base:271.90,  taxes:57.10,  total:329.00,  paid:0, validated:1, comment:'Setas y productos eco temporada' },
    // Pagadas
    { num:'FAC-2026-0092', vendor:'Bodegas Rioja Premium',        payment:'TRF60', date_invoice:dAgo(55), date_due:dAgo(25),  base:776.86,  taxes:163.14, total:940.00,  paid:1, validated:1, comment:'Vinos carta primavera-verano' },
    { num:'FAC-2026-0091', vendor:'Mercabarna Express SL',        payment:'TRF30', date_invoice:dAgo(60), date_due:dAgo(30),  base:258.51,  taxes:54.29,  total:312.80,  paid:1, validated:1, comment:null },
    { num:'FAC-2026-0090', vendor:'Carnes Selectas Martínez',     payment:'TRF30', date_invoice:dAgo(65), date_due:dAgo(35),  base:394.71,  taxes:82.89,  total:477.60,  paid:1, validated:1, comment:null },
    { num:'FAC-2026-0089', vendor:'Pescados del Atlántico SA',    payment:'TRF30', date_invoice:mAgo(2,10),date_due:mAgo(1,25),base:432.31, taxes:90.85,  total:523.10,  paid:1, validated:1, comment:null },
    { num:'FAC-2026-0088', vendor:'Bodegas Rioja Premium',        payment:'TRF60', date_invoice:mAgo(2,5), date_due:mAgo(1,20),base:694.21, taxes:145.78, total:840.00,  paid:1, validated:1, comment:'Vinos reserva' },
    { num:'FAC-2025-0210', vendor:'Charcutería Ibérica',          payment:'TRF60', date_invoice:mAgo(4,10),date_due:mAgo(3,25),base:1305.79,taxes:274.22, total:1580.00, paid:1, validated:1, comment:'Ibéricos Navidad' },
    { num:'FAC-2025-0185', vendor:'Bodegas Rioja Premium',        payment:'TRF60', date_invoice:mAgo(4,5), date_due:mAgo(3,20),base:1851.24,taxes:388.76, total:2240.00, paid:1, validated:1, comment:'Gran pedido vinos Navidad' },
  ]
  for (const f of facturas) {
    const v = vInfo[f.vendor] ?? { codi: null, nif: null }
    const dacc = f.date_invoice
    db.prepare(`INSERT INTO facturas_compra (user_id,invoice_num,document_num,vendor,code_vendor,nif,account_vendor,date_invoice,date_accounting,date_due,code_payment_type,base,taxes,total,paid,validated,comment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uid,f.num,f.num.replace('FAC','DOC'),f.vendor,v.codi,v.nif,`400${v.codi?.replace('PROV','')}`,f.date_invoice,dacc,f.date_due,f.payment,f.base,f.taxes,f.total,f.paid,f.validated,f.comment??null)
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
    db.prepare(`INSERT INTO facturas_venta (user_id,invoice_num,customer,date_invoice,date_due,base,taxes,total,paid) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid,`FVE-2026-${String(i+1).padStart(3,'0')}`,clientes[ci],dAgo(i*8+2),dAgo(i*8-28),base,taxes,base+taxes,i<8?1:0)
  }

  // ── PRECIO HISTORIAL (6 meses + esta semana con subidas) ─────────────────
  const histPrecios = [
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precios:[
      { precio:4.80, fecha:mAgo(6,1) },{ precio:5.20, fecha:mAgo(5,1) },{ precio:5.60, fecha:mAgo(4,1) },
      { precio:6.20, fecha:mAgo(3,1) },{ precio:6.60, fecha:mAgo(2,1) },{ precio:6.90, fecha:mAgo(1,1) },
      { precio:7.20, fecha:dAgo(3) },  // +50% acumulado — alerta esta semana
    ]},
    { nombre:'Aceite de oliva virgen extra', vendor:'Distribuciones Roca Alimentación', precios:[
      { precio:5.40, fecha:mAgo(3,1) },{ precio:5.80, fecha:mAgo(1,1) },{ precio:6.10, fecha:dAgo(10) },
    ]},
    { nombre:'Salmón fresco (lomo)', vendor:'Pescados del Atlántico SA', precios:[
      { precio:11.80, fecha:mAgo(6,1) },{ precio:12.40, fecha:mAgo(5,1) },{ precio:13.20, fecha:mAgo(4,1) },
      { precio:14.00, fecha:mAgo(3,1) },{ precio:14.80, fecha:mAgo(2,1) },{ precio:15.20, fecha:mAgo(1,1) },
      { precio:15.20, fecha:dAgo(8) },  // sin cambio esta semana
    ]},
    { nombre:'Salmón fresco (lomo)', vendor:'Mercabarna Express SL', precios:[
      { precio:13.50, fecha:mAgo(3,1) },{ precio:14.20, fecha:mAgo(1,1) },{ precio:14.80, fecha:dAgo(10) },
    ]},
    { nombre:'Gambas rojas (16/20)', vendor:'Mariscos Costa Brava SL', precios:[
      { precio:24.00, fecha:mAgo(5,1) },{ precio:26.00, fecha:mAgo(4,1) },{ precio:28.00, fecha:mAgo(3,1) },
      { precio:29.50, fecha:mAgo(2,1) },{ precio:31.00, fecha:mAgo(1,1) },
      { precio:33.50, fecha:dAgo(1) },  // +8% esta semana — alerta
    ]},
    { nombre:'Gambas rojas (16/20)', vendor:'Distribuciones Roca Alimentación', precios:[
      { precio:32.00, fecha:mAgo(2,1) },{ precio:34.00, fecha:dAgo(11) },
    ]},
    { nombre:'Nata líquida 35% MG', vendor:'Lácteos Frescos del Pirineo', precios:[
      { precio:1.90, fecha:mAgo(5,1) },{ precio:2.10, fecha:mAgo(4,1) },{ precio:2.30, fecha:mAgo(3,1) },
      { precio:2.45, fecha:mAgo(2,1) },{ precio:2.60, fecha:mAgo(1,1) },
      { precio:2.80, fecha:dAgo(2) },  // +8% esta semana
    ]},
    { nombre:'Pechuga de pollo (filetes)', vendor:'Carnes Selectas Martínez', precios:[
      { precio:7.10, fecha:mAgo(5,1) },{ precio:6.80, fecha:mAgo(4,1) },{ precio:6.50, fecha:mAgo(3,1) },
      { precio:6.20, fecha:mAgo(2,1) },{ precio:6.20, fecha:dAgo(14) },
    ]},
    { nombre:'Pechuga de pollo (filetes)', vendor:'Distribuciones Roca Alimentación', precios:[
      { precio:7.50, fecha:mAgo(3,1) },{ precio:7.10, fecha:mAgo(1,1) },{ precio:7.40, fecha:dAgo(11) },
    ]},
    { nombre:'Solomillo de ternera', vendor:'Carnes Selectas Martínez', precios:[
      { precio:28.00, fecha:mAgo(5,1) },{ precio:30.00, fecha:mAgo(4,1) },{ precio:32.00, fecha:mAgo(3,1) },
      { precio:33.00, fecha:mAgo(2,1) },{ precio:34.00, fecha:mAgo(1,1) },
      { precio:36.50, fecha:dAgo(2) },  // +7% esta semana — alerta crítica en recetas
    ]},
    { nombre:'Atún rojo (sashimi)', vendor:'Pescados del Atlántico SA', precios:[
      { precio:36.00, fecha:mAgo(4,1) },{ precio:38.00, fecha:mAgo(3,1) },{ precio:40.00, fecha:mAgo(2,1) },
      { precio:42.00, fecha:mAgo(1,1) },{ precio:44.00, fecha:dAgo(5) },  // +22% en 4 meses
    ]},
    { nombre:'Foie gras mi-cuit', vendor:'Charcutería Ibérica Extremeña', precios:[
      { precio:58.00, fecha:mAgo(5,1) },{ precio:62.00, fecha:mAgo(4,1) },{ precio:66.00, fecha:mAgo(3,1) },
      { precio:70.00, fecha:mAgo(2,1) },{ precio:72.00, fecha:mAgo(1,1) },
      { precio:75.00, fecha:dAgo(4) },  // +4% esta semana
    ]},
    { nombre:'Harina de trigo T55', vendor:'Harinera del Norte SL', precios:[
      { precio:0.75, fecha:mAgo(5,1) },{ precio:0.80, fecha:mAgo(4,1) },
      { precio:0.85, fecha:mAgo(3,1) },{ precio:0.90, fecha:mAgo(2,1) },{ precio:0.92, fecha:mAgo(1,1) },
    ]},
    { nombre:'Bogavante gallego', vendor:'Mariscos Costa Brava SL', precios:[
      { precio:48.00, fecha:mAgo(4,1) },{ precio:52.00, fecha:mAgo(2,1) },
      { precio:58.00, fecha:mAgo(1,1) },{ precio:62.00, fecha:dAgo(1) },  // +29% — alerta diferencial
    ]},
    { nombre:'Frambuesa fresca', vendor:'Mercabarna Express SL', precios:[
      { precio:14.00, fecha:mAgo(3,1) },{ precio:16.50, fecha:mAgo(2,1) },
      { precio:19.50, fecha:mAgo(1,1) },{ precio:21.00, fecha:dAgo(3) },  // +50% en 3 meses
    ]},
    { nombre:'Tomate rama madurado', vendor:'Mercabarna Express SL', precios:[
      { precio:1.40, fecha:mAgo(4,1) },{ precio:1.60, fecha:mAgo(3,1) },
      { precio:1.80, fecha:mAgo(2,1) },{ precio:2.10, fecha:mAgo(1,1) },{ precio:2.10, fecha:dAgo(7) },
    ]},
    { nombre:'Tomate rama madurado', vendor:'Verduras del Mediterráneo SL', precios:[
      { precio:1.60, fecha:mAgo(3,1) },{ precio:1.90, fecha:mAgo(1,1) },{ precio:2.30, fecha:dAgo(9) },
    ]},
  ]
  for (const h of histPrecios) {
    for (const pp of h.precios) {
      db.prepare(`INSERT INTO precio_historial (user_id,nombre,vendor,precio,unidad,fecha,fuente) VALUES (?,?,?,?,?,'kg','albaran')`)
        .run(uid,h.nombre,h.vendor,pp.precio,pp.fecha)
    }
  }

  // ── MERMA REGISTRO ────────────────────────────────────────────────────────
  const mermas = [
    // Esta semana — importante para el informe semanal
    { nombre:'Salmón fresco (lomo)',          cantidad:1.4, unidad:'kg', motivo:'caducidad',       coste_estimado:21.28, fecha:dAgo(0), notas:'Llegó en mal estado — proveedor debe compensar' },
    { nombre:'Gambas rojas (16/20)',           cantidad:0.6, unidad:'kg', motivo:'caducidad',       coste_estimado:18.60, fecha:dAgo(1), notas:'Servicio de mediodía cancelado' },
    { nombre:'Nata líquida 35% MG',            cantidad:2.5, unidad:'l',  motivo:'sobreproducción', coste_estimado:6.50,  fecha:dAgo(1), notas:'Exceso mise en place servicio noche' },
    { nombre:'Atún rojo (sashimi)',            cantidad:0.2, unidad:'kg', motivo:'sobreproducción', coste_estimado:8.80,  fecha:dAgo(2), notas:'Pocas reservas en servicio' },
    { nombre:'Bogavante gallego',              cantidad:0.5, unidad:'kg', motivo:'caducidad',       coste_estimado:29.00, fecha:dAgo(2), notas:'No se vendió el menú especial' },
    { nombre:'Frambuesa fresca',               cantidad:0.4, unidad:'kg', motivo:'caducidad',       coste_estimado:7.80,  fecha:dAgo(3), notas:'Maduración muy rápida' },
    { nombre:'Foie gras mi-cuit',              cantidad:0.1, unidad:'kg', motivo:'sobreproducción', coste_estimado:7.20,  fecha:dAgo(4), notas:'Degustación cancelada última hora' },
    { nombre:'Pan de molde brioche',           cantidad:10,  unidad:'ud', motivo:'caducidad',       coste_estimado:13.00, fecha:dAgo(4), notas:'No se vendió fin de semana' },
    { nombre:'Pechuga de pollo (filetes)',     cantidad:0.6, unidad:'kg', motivo:'pérdida',         coste_estimado:3.72,  fecha:dAgo(5), notas:null },
    { nombre:'Espárrago verde (calibre 16)',   cantidad:0.5, unidad:'kg', motivo:'caducidad',       coste_estimado:2.60,  fecha:dAgo(5), notas:null },
    { nombre:'Huevos camperos L (docena)',     cantidad:6,   unidad:'ud', motivo:'rotura',          coste_estimado:1.80,  fecha:dAgo(6), notas:null },
    { nombre:'Seta shiitake fresca',           cantidad:0.5, unidad:'kg', motivo:'caducidad',       coste_estimado:6.75,  fecha:dAgo(6), notas:'Entrega con retraso — ya no utilizables' },
    // Semana anterior
    { nombre:'Tomate rama madurado',           cantidad:4.0, unidad:'kg', motivo:'caducidad',       coste_estimado:8.40,  fecha:dAgo(9),  notas:'Sobrestock fin de semana largo' },
    { nombre:'Aceite de oliva virgen extra',   cantidad:0.5, unidad:'l',  motivo:'rotura',          coste_estimado:3.60,  fecha:dAgo(11), notas:'Botella rota durante servicio' },
    { nombre:'Merluza fresca (filete)',        cantidad:0.7, unidad:'kg', motivo:'sobreproducción', coste_estimado:6.86,  fecha:dAgo(12), notas:null },
    { nombre:'Carrillera de cerdo',            cantidad:0.9, unidad:'kg', motivo:'rotura',          coste_estimado:6.66,  fecha:dAgo(13), notas:'Caída en cámara frigorífica' },
    // Mes anterior
    { nombre:'Bacalao desalado',               cantidad:0.9, unidad:'kg', motivo:'pérdida',         coste_estimado:10.44, fecha:mAgo(1,28), notas:'Descongelación involuntaria — apagón' },
    { nombre:'Queso manchego curado',          cantidad:0.4, unidad:'kg', motivo:'caducidad',       coste_estimado:5.68,  fecha:mAgo(1,25), notas:null },
    { nombre:'Caldo de pollo (envase 1L)',     cantidad:3,   unidad:'l',  motivo:'sobreproducción', coste_estimado:3.90,  fecha:mAgo(1,20), notas:null },
    { nombre:'Vieiras (concha)',               cantidad:4,   unidad:'ud', motivo:'caducidad',       coste_estimado:12.80, fecha:mAgo(1,15), notas:'Llegaron dañadas en el transporte' },
    { nombre:'Mango (extra)',                  cantidad:2.0, unidad:'kg', motivo:'caducidad',       coste_estimado:8.40,  fecha:mAgo(1,10), notas:'Maduración muy rápida en cámara' },
    { nombre:'Albahaca fresca (maceta)',       cantidad:3,   unidad:'ud', motivo:'caducidad',       coste_estimado:5.70,  fecha:mAgo(1,5),  notas:'No se usó en servicio del fin de semana' },
  ]
  for (const m of mermas) {
    db.prepare(`INSERT INTO merma_registro (user_id,nombre,cantidad,unidad,motivo,coste_estimado,fecha,notas) VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid,m.nombre,m.cantidad,m.unidad,m.motivo,m.coste_estimado,m.fecha,m.notas??null)
  }

  // ── LINEAS ALBARÁN COMPRA ─────────────────────────────────────────────────
  const qtyByType: Record<string, [number, number]> = {
    Pescado:[4,15], Marisco:[3,12], Carne:[5,25], Charcutería:[1,5],
    Verdura:[5,25], Hongo:[1,4],   Lácteo:[3,15],
    Aceite:[5,20],  Conserva:[3,12],
    Harina:[20,50], Cereal:[10,30], Pasta:[5,15],
    Panadería:[15,40], Caldo:[5,18],
    Vino:[6,18],    Licor:[2,8],
    Azúcar:[5,25],  Repostería:[1,4],
    Fruta:[5,18],   Condimento:[1,3], Especia:[0.5,2], Hierba:[3,10],
  }
  const rand  = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 100) / 100
  const randInt = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1))

  // Albarán con líneas detalladas — esta semana (Pescados del Atlántico SA, hoy)
  const lineasPescadoHoy = [
    { vendor:'Pescados del Atlántico SA', nombre:'Salmón fresco (lomo)',    cantidad:8,   unidad:'kg', precio_unitario:15.20, total_linea:121.60, fecha:dAgo(0) },
    { vendor:'Pescados del Atlántico SA', nombre:'Lubina fresca entera',    cantidad:12,  unidad:'kg', precio_unitario:12.60, total_linea:151.20, fecha:dAgo(0) },
    { vendor:'Pescados del Atlántico SA', nombre:'Atún rojo (sashimi)',     cantidad:4,   unidad:'kg', precio_unitario:44.00, total_linea:176.00, fecha:dAgo(0) },
    { vendor:'Pescados del Atlántico SA', nombre:'Merluza fresca (filete)', cantidad:10,  unidad:'kg', precio_unitario:9.80,  total_linea:98.00,  fecha:dAgo(0) },
    { vendor:'Pescados del Atlántico SA', nombre:'Rodaballo fresco',        cantidad:5,   unidad:'kg', precio_unitario:24.00, total_linea:120.00, fecha:dAgo(0) },
    { vendor:'Pescados del Atlántico SA', nombre:'Fumet de pescado',        cantidad:15,  unidad:'l',  precio_unitario:2.60,  total_linea:39.00,  fecha:dAgo(0) },
  ]
  // Albarán Mariscos ayer
  const lineasMariscosAyer = [
    { vendor:'Mariscos Costa Brava SL', nombre:'Gambas rojas (16/20)',    cantidad:10, unidad:'kg', precio_unitario:33.50, total_linea:335.00, fecha:dAgo(1) },
    { vendor:'Mariscos Costa Brava SL', nombre:'Pulpo cocido (tentáculos)', cantidad:8, unidad:'kg', precio_unitario:12.40, total_linea:99.20,  fecha:dAgo(1) },
    { vendor:'Mariscos Costa Brava SL', nombre:'Almejas frescas',          cantidad:5, unidad:'kg', precio_unitario:14.80, total_linea:74.00,  fecha:dAgo(1) },
    { vendor:'Mariscos Costa Brava SL', nombre:'Bogavante gallego',        cantidad:3, unidad:'kg', precio_unitario:62.00, total_linea:186.00, fecha:dAgo(1) },
    { vendor:'Mariscos Costa Brava SL', nombre:'Cigala mediana (fresca)',  cantidad:20, unidad:'ud', precio_unitario:6.50,  total_linea:130.00, fecha:dAgo(1) },
  ]
  // Albarán Mercabarna ayer
  const lineasMercabarna = [
    { vendor:'Mercabarna Express SL', nombre:'Tomate rama madurado',        cantidad:20, unidad:'kg', precio_unitario:2.10,  total_linea:42.00,  fecha:dAgo(1) },
    { vendor:'Mercabarna Express SL', nombre:'Espárrago verde (calibre 16)',cantidad:8,  unidad:'kg', precio_unitario:5.20,  total_linea:41.60,  fecha:dAgo(1) },
    { vendor:'Mercabarna Express SL', nombre:'Fresas frescas (bandeja 500g)',cantidad:10, unidad:'kg', precio_unitario:5.50,  total_linea:55.00,  fecha:dAgo(1) },
    { vendor:'Mercabarna Express SL', nombre:'Frambuesa fresca',            cantidad:4,  unidad:'kg', precio_unitario:21.00, total_linea:84.00,  fecha:dAgo(1) },
    { vendor:'Mercabarna Express SL', nombre:'Tomate cherry mix',           cantidad:6,  unidad:'kg', precio_unitario:3.80,  total_linea:22.80,  fecha:dAgo(1) },
    { vendor:'Mercabarna Express SL', nombre:'Pimiento rojo extra',         cantidad:10, unidad:'kg', precio_unitario:1.40,  total_linea:14.00,  fecha:dAgo(1) },
    { vendor:'Mercabarna Express SL', nombre:'Limón (malla 5kg)',           cantidad:15, unidad:'kg', precio_unitario:1.50,  total_linea:22.50,  fecha:dAgo(1) },
  ]
  // Albarán Carnes hace 2 días
  const lineasCarnes = [
    { vendor:'Carnes Selectas Martínez', nombre:'Solomillo de ternera',      cantidad:6,  unidad:'kg', precio_unitario:36.50, total_linea:219.00, fecha:dAgo(2) },
    { vendor:'Carnes Selectas Martínez', nombre:'Carrillera de cerdo',        cantidad:12, unidad:'kg', precio_unitario:7.40,  total_linea:88.80,  fecha:dAgo(2) },
    { vendor:'Carnes Selectas Martínez', nombre:'Pechuga de pollo (filetes)', cantidad:15, unidad:'kg', precio_unitario:6.20,  total_linea:93.00,  fecha:dAgo(2) },
    { vendor:'Carnes Selectas Martínez', nombre:'Muslo de pato confitado',    cantidad:12, unidad:'ud', precio_unitario:4.80,  total_linea:57.60,  fecha:dAgo(2) },
    { vendor:'Carnes Selectas Martínez', nombre:'Cordero lechal (pierna)',    cantidad:4,  unidad:'kg', precio_unitario:17.50, total_linea:70.00,  fecha:dAgo(2) },
  ]
  // Albarán Charcutería hace 6 días
  const lineasCharcuteria = [
    { vendor:'Charcutería Ibérica Extremeña', nombre:'Foie gras mi-cuit',          cantidad:2,  unidad:'kg', precio_unitario:75.00, total_linea:150.00, fecha:dAgo(6) },
    { vendor:'Charcutería Ibérica Extremeña', nombre:'Jamón ibérico de bellota',    cantidad:3,  unidad:'kg', precio_unitario:98.00, total_linea:294.00, fecha:dAgo(6) },
    { vendor:'Charcutería Ibérica Extremeña', nombre:'Chorizo ibérico curado',      cantidad:5,  unidad:'kg', precio_unitario:22.00, total_linea:110.00, fecha:dAgo(6) },
    { vendor:'Charcutería Ibérica Extremeña', nombre:'Panceta ahumada (lonchas)',   cantidad:8,  unidad:'kg', precio_unitario:11.50, total_linea:92.00,  fecha:dAgo(6) },
  ]

  // Auto-generate historical lines per ingredient
  const lineasAuto: any[] = []
  let idx = 0
  for (const ing of ingredientes) {
    const provCodi = ingProvMap[ing.codi]
    if (!provCodi) continue
    const provDescr = proveedores.find(p => p.codi === provCodi)!.descr
    const range = qtyByType[ing.type] || [1, 5]
    const cycle = idx % 5
    let lastDays: number
    if (cycle === 0) lastDays = randInt(2, 4)
    else if (cycle === 1) lastDays = randInt(8, 14)
    else if (cycle === 2) lastDays = randInt(15, 22)
    else if (cycle === 3) lastDays = randInt(10, 18)
    else lastDays = randInt(25, 40)

    const cant1 = rand(range[0], range[1])
    lineasAuto.push({ vendor:provDescr, nombre:ing.descr, cantidad:cant1, unidad:ing.unit,
      precio_unitario:ing.cost, total_linea:Math.round(cant1*ing.cost*100)/100, fecha:dAgo(lastDays) })
    const cant2 = rand(range[0], range[1])
    lineasAuto.push({ vendor:provDescr, nombre:ing.descr, cantidad:cant2, unidad:ing.unit,
      precio_unitario:Math.round(ing.cost*(0.88+Math.random()*0.18)*100)/100,
      total_linea:Math.round(cant2*ing.cost*100)/100, fecha:dAgo(lastDays+randInt(14,28)) })
    if (idx % 2 === 0) {
      const cant3 = rand(range[0], range[1])
      lineasAuto.push({ vendor:provDescr, nombre:ing.descr, cantidad:cant3, unidad:ing.unit,
        precio_unitario:Math.round(ing.cost*(0.83+Math.random()*0.2)*100)/100,
        total_linea:Math.round(cant3*ing.cost*100)/100, fecha:dAgo(lastDays+randInt(35,55)) })
    }
    idx++
  }

  // Comparativa precios — mismo producto, varios proveedores
  const lineasComparativa = [
    { vendor:'Distribuciones Roca Alimentación', nombre:'Tomate rama madurado',         cantidad:15, unidad:'kg', precio_unitario:2.30, total_linea:34.50, fecha:dAgo(11) },
    { vendor:'Distribuciones Roca Alimentación', nombre:'Aceite de oliva virgen extra',  cantidad:10, unidad:'l',  precio_unitario:5.80, total_linea:58.00, fecha:dAgo(13) },
    { vendor:'Distribuciones Roca Alimentación', nombre:'Pechuga de pollo (filetes)',    cantidad:10, unidad:'kg', precio_unitario:7.40, total_linea:74.00, fecha:dAgo(13) },
    { vendor:'Mariscos Costa Brava SL',          nombre:'Gambas rojas (16/20)',          cantidad:5,  unidad:'kg', precio_unitario:33.50, total_linea:167.50, fecha:dAgo(1) },
    { vendor:'Mercabarna Express SL',            nombre:'Salmón fresco (lomo)',          cantidad:5,  unidad:'kg', precio_unitario:14.80, total_linea:74.00, fecha:dAgo(11) },
    { vendor:'Verduras del Mediterráneo SL',     nombre:'Espárrago verde (calibre 16)',  cantidad:8,  unidad:'kg', precio_unitario:4.80,  total_linea:38.40, fecha:dAgo(10) },
    { vendor:'Ecológicos del Valle SL',          nombre:'Tomate rama madurado',          cantidad:8,  unidad:'kg', precio_unitario:3.20,  total_linea:25.60, fecha:dAgo(9) },
    { vendor:'Verduras del Mediterráneo SL',     nombre:'Tomate rama madurado',          cantidad:12, unidad:'kg', precio_unitario:2.30,  total_linea:27.60, fecha:dAgo(9) },
  ]

  for (const l of [...lineasPescadoHoy, ...lineasMariscosAyer, ...lineasMercabarna, ...lineasCarnes, ...lineasCharcuteria, ...lineasAuto, ...lineasComparativa]) {
    db.prepare(`INSERT INTO lineas_albaran_compra (user_id,vendor,nombre,cantidad,unidad,precio_unitario,total_linea,fecha) VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid,l.vendor,l.nombre,l.cantidad,l.unidad,l.precio_unitario,l.total_linea,l.fecha)
  }

  // ── ESCANDALLO RECETAS ────────────────────────────────────────────────────
  // Food cost = coste_total / precio_venta. >35% = crítico, >30% = revisar
  const recetas = [
    // ── FOOD COST CRÍTICO (>35%) ──
    { nombre:'Bogavante a la brasa con mantequilla de hierbas', categoria:'Segundos', raciones:1, precio_venta:62.00, merma_pct:10, lineas:[
      { nombre_libre:'Bogavante gallego',             cantidad:0.420, unidad:'kg', coste_unitario:58.00 }, // 24.36
      { nombre_libre:'Mantequilla sin sal (placa)',   cantidad:0.060, unidad:'kg', coste_unitario:9.20  }, // 0.55
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.020, unidad:'l',  coste_unitario:7.20  }, // 0.14
      { nombre_libre:'Limón (malla 5kg)',             cantidad:0.030, unidad:'kg', coste_unitario:1.50  }, // 0.05
      { nombre_libre:'Romero fresco (manojo)',        cantidad:0.200, unidad:'ud', coste_unitario:0.65  }, // 0.13
      // total ≈ 25.23 / 62.00 = 40.7% ← CRÍTICO
    ]},
    { nombre:'Cigalas a la plancha con salsa verde', categoria:'Entrantes', raciones:1, precio_venta:48.00, merma_pct:8, lineas:[
      { nombre_libre:'Cigala mediana (fresca)',       cantidad:4.000, unidad:'ud', coste_unitario:6.50  }, // 26.00
      { nombre_libre:'Ajo morado fresco',             cantidad:0.010, unidad:'kg', coste_unitario:3.60  }, // 0.04
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.030, unidad:'l',  coste_unitario:7.20  }, // 0.22
      { nombre_libre:'Vino blanco Albariño (cocina)', cantidad:0.060, unidad:'l',  coste_unitario:5.20  }, // 0.31
      { nombre_libre:'Albahaca fresca (maceta)',      cantidad:0.100, unidad:'ud', coste_unitario:1.90  }, // 0.19
      // total ≈ 26.76 / 48.00 = 55.8% ← MUY CRÍTICO
    ]},
    { nombre:'Solomillo al foie con reducción de Rioja', categoria:'Segundos', raciones:1, precio_venta:44.00, merma_pct:8, lineas:[
      { nombre_libre:'Solomillo de ternera',          cantidad:0.230, unidad:'kg', coste_unitario:34.00 }, // 7.82
      { nombre_libre:'Foie gras mi-cuit',             cantidad:0.045, unidad:'kg', coste_unitario:72.00 }, // 3.24
      { nombre_libre:'Mantequilla sin sal (placa)',   cantidad:0.025, unidad:'kg', coste_unitario:9.20  }, // 0.23
      { nombre_libre:'Vino tinto Rioja (cocina)',     cantidad:0.100, unidad:'l',  coste_unitario:3.80  }, // 0.38
      { nombre_libre:'Trufa negra rallada (tarro)',   cantidad:2.000, unidad:'g',  coste_unitario:0.90  }, // 1.80
      // total ≈ 13.47 / 44.00 = 30.6% ← REVISAR (limítrofe)
    ]},
    // ── FOOD COST NORMAL ──
    { nombre:'Salmón a la plancha con velouté de espárragos', categoria:'Segundos', raciones:1, precio_venta:24.00, merma_pct:8, lineas:[
      { nombre_libre:'Salmón fresco (lomo)',          cantidad:0.180, unidad:'kg', coste_unitario:15.20 },
      { nombre_libre:'Espárrago verde (calibre 16)',  cantidad:0.080, unidad:'kg', coste_unitario:5.20  },
      { nombre_libre:'Nata líquida 35% MG',           cantidad:0.050, unidad:'l',  coste_unitario:2.60  },
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.020, unidad:'l',  coste_unitario:7.20  },
      { nombre_libre:'Mantequilla sin sal (placa)',   cantidad:0.015, unidad:'kg', coste_unitario:9.20  },
      // total ≈ 3.71 / 24.00 = 15.5%
    ]},
    { nombre:'Arroz negro con gambas y alioli de tinta', categoria:'Arroces', raciones:1, precio_venta:26.00, merma_pct:10, lineas:[
      { nombre_libre:'Arroz bomba (DO Valencia)',     cantidad:0.100, unidad:'kg', coste_unitario:2.20  },
      { nombre_libre:'Gambas rojas (16/20)',          cantidad:0.120, unidad:'kg', coste_unitario:31.00 },
      { nombre_libre:'Fumet de pescado',              cantidad:0.300, unidad:'l',  coste_unitario:2.60  },
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.025, unidad:'l',  coste_unitario:7.20  },
      { nombre_libre:'Cebolla blanca grande',         cantidad:0.060, unidad:'kg', coste_unitario:0.65  },
      // total ≈ 4.76 / 26.00 = 18.3%
    ]},
    { nombre:'Tataki de atún rojo con wakame y soja', categoria:'Entrantes', raciones:1, precio_venta:28.00, merma_pct:6, lineas:[
      { nombre_libre:'Atún rojo (sashimi)',           cantidad:0.130, unidad:'kg', coste_unitario:44.00 },
      { nombre_libre:'Aceite de girasol refinado',    cantidad:0.020, unidad:'l',  coste_unitario:1.50  },
      { nombre_libre:'Rúcula fresca (bolsa)',         cantidad:0.025, unidad:'kg', coste_unitario:6.80  },
      // total ≈ 5.90 / 28.00 = 21.1%
    ]},
    { nombre:'Crema de tomate asado con albahaca', categoria:'Primeros', raciones:1, precio_venta:10.50, merma_pct:5, lineas:[
      { nombre_libre:'Tomate rama madurado',          cantidad:0.220, unidad:'kg', coste_unitario:2.10  },
      { nombre_libre:'Nata líquida 35% MG',           cantidad:0.050, unidad:'l',  coste_unitario:2.60  },
      { nombre_libre:'Cebolla blanca grande',         cantidad:0.040, unidad:'kg', coste_unitario:0.65  },
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.015, unidad:'l',  coste_unitario:7.20  },
      { nombre_libre:'Albahaca fresca (maceta)',      cantidad:0.005, unidad:'ud', coste_unitario:1.90  },
      // total ≈ 0.77 / 10.50 = 7.3%
    ]},
    { nombre:'Pulpo a la gallega con cachelos y pimentón', categoria:'Entrantes', raciones:1, precio_venta:18.00, merma_pct:12, lineas:[
      { nombre_libre:'Pulpo cocido (tentáculos)',     cantidad:0.200, unidad:'kg', coste_unitario:12.40 },
      { nombre_libre:'Patata agria (Monalisa)',       cantidad:0.150, unidad:'kg', coste_unitario:0.55  },
      { nombre_libre:'Pimentón ahumado La Vera',      cantidad:0.003, unidad:'kg', coste_unitario:9.20  },
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.030, unidad:'l',  coste_unitario:7.20  },
      // total ≈ 2.74 / 18.00 = 15.2%
    ]},
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez', categoria:'Segundos', raciones:1, precio_venta:19.50, merma_pct:10, lineas:[
      { nombre_libre:'Carrillera de cerdo',           cantidad:0.280, unidad:'kg', coste_unitario:7.40  },
      { nombre_libre:'Cebolla blanca grande',         cantidad:0.080, unidad:'kg', coste_unitario:0.65  },
      { nombre_libre:'Zanahoria (pelada)',            cantidad:0.060, unidad:'kg', coste_unitario:0.75  },
      { nombre_libre:'Vino tinto Rioja (cocina)',     cantidad:0.120, unidad:'l',  coste_unitario:3.80  },
      { nombre_libre:'Fondo oscuro de ternera',       cantidad:0.150, unidad:'l',  coste_unitario:3.80  },
      // total ≈ 3.20 / 19.50 = 16.4%
    ]},
    { nombre:'Vieiras con crema de coliflor y caviar', categoria:'Entrantes', raciones:1, precio_venta:22.00, merma_pct:8, lineas:[
      { nombre_libre:'Vieiras (concha)',              cantidad:3.000, unidad:'ud', coste_unitario:3.20  },
      { nombre_libre:'Nata líquida 35% MG',           cantidad:0.060, unidad:'l',  coste_unitario:2.60  },
      { nombre_libre:'Mantequilla sin sal (placa)',   cantidad:0.020, unidad:'kg', coste_unitario:9.20  },
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.015, unidad:'l',  coste_unitario:7.20  },
      // total ≈ 9.93 / 22.00 = 45.1% ← CRÍTICO (vieiras han subido precio)
    ]},
    { nombre:'Lubina al horno con patatas panaderas', categoria:'Segundos', raciones:1, precio_venta:28.00, merma_pct:15, lineas:[
      { nombre_libre:'Lubina fresca entera',          cantidad:0.350, unidad:'kg', coste_unitario:12.60 },
      { nombre_libre:'Patata agria (Monalisa)',       cantidad:0.200, unidad:'kg', coste_unitario:0.55  },
      { nombre_libre:'Cebolla blanca grande',         cantidad:0.080, unidad:'kg', coste_unitario:0.65  },
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.030, unidad:'l',  coste_unitario:7.20  },
      { nombre_libre:'Vino blanco Albariño (cocina)', cantidad:0.060, unidad:'l',  coste_unitario:5.20  },
      // total ≈ 5.00 / 28.00 = 17.9%
    ]},
    { nombre:'Risotto de boletus con parmesano', categoria:'Primeros', raciones:1, precio_venta:16.00, merma_pct:8, lineas:[
      { nombre_libre:'Arroz bomba (DO Valencia)',     cantidad:0.090, unidad:'kg', coste_unitario:2.20  },
      { nombre_libre:'Boletus edulis (congelado)',    cantidad:0.060, unidad:'kg', coste_unitario:30.00 },
      { nombre_libre:'Queso parmesano (cuña)',        cantidad:0.030, unidad:'kg', coste_unitario:19.50 },
      { nombre_libre:'Caldo de pollo (envase 1L)',    cantidad:0.300, unidad:'l',  coste_unitario:1.30  },
      { nombre_libre:'Mantequilla sin sal (placa)',   cantidad:0.025, unidad:'kg', coste_unitario:9.20  },
      // total ≈ 2.99 / 16.00 = 18.7%
    ]},
    { nombre:'Tarta de chocolate negro con helado de vainilla', categoria:'Postres', raciones:1, precio_venta:8.50, merma_pct:10, lineas:[
      { nombre_libre:'Chocolate negro 70% (pastilla)',cantidad:0.080, unidad:'kg', coste_unitario:12.00 },
      { nombre_libre:'Mantequilla sin sal (placa)',   cantidad:0.040, unidad:'kg', coste_unitario:9.20  },
      { nombre_libre:'Huevos camperos L (docena)',    cantidad:2.000, unidad:'ud', coste_unitario:0.30  },
      { nombre_libre:'Azúcar blanco refinado',        cantidad:0.060, unidad:'kg', coste_unitario:0.98  },
      { nombre_libre:'Harina de trigo T55',           cantidad:0.030, unidad:'kg', coste_unitario:0.92  },
      // total ≈ 1.97 / 8.50 = 23.2%
    ]},
    { nombre:'Panna cotta de frambuesa con coulis', categoria:'Postres', raciones:1, precio_venta:7.50, merma_pct:8, lineas:[
      { nombre_libre:'Nata líquida 35% MG',           cantidad:0.150, unidad:'l',  coste_unitario:2.60  },
      { nombre_libre:'Azúcar blanco refinado',        cantidad:0.040, unidad:'kg', coste_unitario:0.98  },
      { nombre_libre:'Frambuesa fresca',              cantidad:0.080, unidad:'kg', coste_unitario:19.50 },
      // total ≈ 2.03 / 7.50 = 27.1%
    ]},
    { nombre:'Cordero lechal al horno con hierbas de Provenza', categoria:'Segundos', raciones:1, precio_venta:32.00, merma_pct:12, lineas:[
      { nombre_libre:'Cordero lechal (pierna)',       cantidad:0.400, unidad:'kg', coste_unitario:17.50 },
      { nombre_libre:'Ajo morado fresco',             cantidad:0.020, unidad:'kg', coste_unitario:3.60  },
      { nombre_libre:'Romero fresco (manojo)',        cantidad:0.300, unidad:'ud', coste_unitario:0.65  },
      { nombre_libre:'Tomillo fresco (manojo)',       cantidad:0.300, unidad:'ud', coste_unitario:0.60  },
      { nombre_libre:'Aceite de oliva virgen extra',  cantidad:0.030, unidad:'l',  coste_unitario:7.20  },
      // total ≈ 7.60 / 32.00 = 23.7%
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
    // Esta semana
    { nombre:'Salmón a la plancha con velouté de espárragos',         raciones:38, fecha:dAgo(0) },
    { nombre:'Arroz negro con gambas y alioli de tinta',               raciones:22, fecha:dAgo(0) },
    { nombre:'Tataki de atún rojo con wakame y soja',                  raciones:14, fecha:dAgo(0) },
    { nombre:'Bogavante a la brasa con mantequilla de hierbas',        raciones:6,  fecha:dAgo(0) },
    { nombre:'Tarta de chocolate negro con helado de vainilla',        raciones:30, fecha:dAgo(0) },
    { nombre:'Salmón a la plancha con velouté de espárragos',         raciones:32, fecha:dAgo(1) },
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez',          raciones:18, fecha:dAgo(1) },
    { nombre:'Crema de tomate asado con albahaca',                     raciones:48, fecha:dAgo(1) },
    { nombre:'Cigalas a la plancha con salsa verde',                   raciones:10, fecha:dAgo(1) },
    { nombre:'Panna cotta de frambuesa con coulis',                    raciones:24, fecha:dAgo(1) },
    { nombre:'Solomillo al foie con reducción de Rioja',               raciones:12, fecha:dAgo(2) },
    { nombre:'Pulpo a la gallega con cachelos y pimentón',             raciones:26, fecha:dAgo(2) },
    { nombre:'Risotto de boletus con parmesano',                       raciones:16, fecha:dAgo(2) },
    { nombre:'Vieiras con crema de coliflor y caviar',                 raciones:8,  fecha:dAgo(2) },
    { nombre:'Lubina al horno con patatas panaderas',                  raciones:20, fecha:dAgo(3) },
    { nombre:'Cordero lechal al horno con hierbas de Provenza',        raciones:14, fecha:dAgo(3) },
    { nombre:'Arroz negro con gambas y alioli de tinta',               raciones:18, fecha:dAgo(3) },
    { nombre:'Salmón a la plancha con velouté de espárragos',         raciones:28, fecha:dAgo(4) },
    { nombre:'Tataki de atún rojo con wakame y soja',                  raciones:11, fecha:dAgo(4) },
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez',          raciones:15, fecha:dAgo(5) },
    { nombre:'Tarta de chocolate negro con helado de vainilla',        raciones:26, fecha:dAgo(5) },
    { nombre:'Bogavante a la brasa con mantequilla de hierbas',        raciones:4,  fecha:dAgo(6) },
    { nombre:'Crema de tomate asado con albahaca',                     raciones:42, fecha:dAgo(6) },
    // Semana anterior
    { nombre:'Salmón a la plancha con velouté de espárragos',         raciones:30, fecha:dAgo(8) },
    { nombre:'Arroz negro con gambas y alioli de tinta',               raciones:22, fecha:dAgo(8) },
    { nombre:'Crema de tomate asado con albahaca',                     raciones:50, fecha:dAgo(8) },
    { nombre:'Carrilleras de cerdo ibérico al Pedro Ximénez',          raciones:20, fecha:dAgo(9) },
    { nombre:'Tarta de chocolate negro con helado de vainilla',        raciones:34, fecha:dAgo(9) },
    { nombre:'Pulpo a la gallega con cachelos y pimentón',             raciones:22, fecha:dAgo(10) },
    { nombre:'Tataki de atún rojo con wakame y soja',                  raciones:10, fecha:dAgo(10) },
  ]
  for (const p of produccion) {
    const rid = recetaIds[p.nombre] ?? null
    db.prepare(`INSERT INTO ventas_produccion (user_id,receta_id,nombre,raciones,fecha) VALUES (?,?,?,?,?)`)
      .run(uid,rid,p.nombre,p.raciones,p.fecha)
  }

  // ── LABOR + PRODUCTIVITY + REPORTS ────────────────────────────────────────
  seedLaborData(db, uid)
}

// Seed de Labor Cost / Productivity / Reports.
// Se puede ejecutar de forma independiente para cuentas existentes sin perder
// los datos de Food Cost. Si ya hay turnos, no hace nada.
export function seedLaborData(db: Database.Database, uid: string) {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()
  const dAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }

  // Idempotente: si ya hay turnos no re-sembramos
  const existing = (db.prepare('SELECT COUNT(*) as c FROM turnos WHERE user_id=?').get(uid) as any)?.c ?? 0
  if (existing > 0) return

  // ── LOCATIONS ─────────────────────────────────────────────────────────────
  const locations = [
    { site_id: 'MADNUM', nombre: 'Madrid · Núñez de Balboa', ciudad: 'Madrid' },
    { site_id: 'BCNGR',  nombre: 'Barcelona · Gracia (dark)',  ciudad: 'Barcelona' },
  ]
  for (const l of locations) {
    db.prepare(`INSERT INTO locations (user_id, site_id, nombre, ciudad, activo) VALUES (?, ?, ?, ?, 1)`)
      .run(uid, l.site_id, l.nombre, l.ciudad)
  }

  // ── EMPLEADOS ─────────────────────────────────────────────────────────────
  // Salarios brutos típicos en hostelería España (€/h):
  //   Manager: 18-20, Jefe cocina: 16-18, Cocinero: 11-13, Ayudante cocina: 9-11
  //   Camarero/Sala: 10-12, Runner: 9-10, Reparto: 9-11
  const empleados = [
    // MADNUM · Cocina
    { employee_id: 'E-1001', nombre: 'Lucía Vega',      site: 'MADNUM', rol: 'Manager',         contrato: 'Indefinido', coste: 19.50, cse: 25.50, h: 40 },
    { employee_id: 'E-1002', nombre: 'Javier Ortega',   site: 'MADNUM', rol: 'Jefe cocina',     contrato: 'Indefinido', coste: 17.20, cse: 22.50, h: 40 },
    { employee_id: 'E-1003', nombre: 'Ana Pérez',       site: 'MADNUM', rol: 'Cocina',          contrato: 'Indefinido', coste: 12.40, cse: 16.20, h: 40 },
    { employee_id: 'E-1004', nombre: 'Diego Romero',    site: 'MADNUM', rol: 'Cocina',          contrato: 'Indefinido', coste: 12.10, cse: 15.80, h: 40 },
    { employee_id: 'E-1005', nombre: 'Sofía Martín',    site: 'MADNUM', rol: 'Ayudante cocina', contrato: 'Temporal',   coste: 10.20, cse: 13.30, h: 30 },
    { employee_id: 'E-1006', nombre: 'Pablo Núñez',     site: 'MADNUM', rol: 'Prep',            contrato: 'Indefinido', coste: 11.80, cse: 15.40, h: 25 },
    // MADNUM · Sala
    { employee_id: 'E-1007', nombre: 'Carlos Ruiz',     site: 'MADNUM', rol: 'Sala',            contrato: 'Indefinido', coste: 11.50, cse: 15.00, h: 40 },
    { employee_id: 'E-1008', nombre: 'Marta Iglesias',  site: 'MADNUM', rol: 'Sala',            contrato: 'Indefinido', coste: 11.20, cse: 14.60, h: 40 },
    { employee_id: 'E-1009', nombre: 'Mario Bermejo',   site: 'MADNUM', rol: 'Sala',            contrato: 'Temporal',   coste: 10.40, cse: 13.50, h: 25 },
    { employee_id: 'E-1010', nombre: 'Elena Castro',    site: 'MADNUM', rol: 'Runner',          contrato: 'Extra',      coste: 9.80,  cse: 12.80, h: 20 },
    // BCNGR · dark kitchen (más pequeño)
    { employee_id: 'E-2001', nombre: 'Marc Puig',       site: 'BCNGR',  rol: 'Manager',         contrato: 'Indefinido', coste: 18.20, cse: 23.70, h: 40 },
    { employee_id: 'E-2002', nombre: 'Núria Sala',      site: 'BCNGR',  rol: 'Cocina',          contrato: 'Indefinido', coste: 12.00, cse: 15.60, h: 40 },
    { employee_id: 'E-2003', nombre: 'Joan Vidal',      site: 'BCNGR',  rol: 'Cocina',          contrato: 'Indefinido', coste: 11.80, cse: 15.40, h: 40 },
    { employee_id: 'E-2004', nombre: 'Aina Roca',       site: 'BCNGR',  rol: 'Reparto',         contrato: 'Temporal',   coste: 10.50, cse: 13.70, h: 30 },
    { employee_id: 'E-2005', nombre: 'Pau Mestre',      site: 'BCNGR',  rol: 'Reparto',         contrato: 'Extra',      coste: 9.90,  cse: 12.90, h: 20 },
  ]
  const empIdByCode: Record<string, number> = {}
  for (const e of empleados) {
    const r = db.prepare(`
      INSERT INTO empleados (user_id, employee_id, nombre, site_id, rol, tipo_contrato, coste_hora, coste_empresa, contract_hours_week, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(uid, e.employee_id, e.nombre, e.site, e.rol, e.contrato, e.coste, e.cse, e.h)
    empIdByCode[e.employee_id] = r.lastInsertRowid as number
  }

  // ── TURNOS (últimos 21 días) ──────────────────────────────────────────────
  // Patrón realista: Mar–Sáb operación normal, Dom turno reducido, Lun cerrado
  // Servicios:
  //   Comida: 11:30 – 16:30 (cocina) / 12:30 – 16:30 (sala)
  //   Cena:   18:30 – 00:00 (cocina) / 19:30 – 00:30 (sala)
  //   Prep:   09:00 – 14:00 (solo prep)
  //   Manager: 10:00 – 18:00 / 16:00 – 00:00 alternando
  // BCNGR (dark): 11:00 – 16:00 + 18:00 – 23:30 reparto + 1 cocinero por servicio

  type ShiftPlan = { emp_code: string; start: string; end: string; brk: number; servicio: string }
  const turno_madnum_normal: ShiftPlan[] = [
    // Manager (alterna)
    { emp_code: 'E-1001', start: '10:00', end: '18:00', brk: 30, servicio: 'All day' },
    // Cocina · comida
    { emp_code: 'E-1002', start: '11:00', end: '16:30', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-1003', start: '11:30', end: '16:30', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-1005', start: '11:30', end: '16:00', brk: 30, servicio: 'Comida' },
    // Sala · comida
    { emp_code: 'E-1007', start: '12:30', end: '16:30', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-1008', start: '12:30', end: '16:30', brk: 30, servicio: 'Comida' },
    // Prep
    { emp_code: 'E-1006', start: '09:00', end: '14:00', brk: 30, servicio: 'Prep' },
    // Cocina · cena
    { emp_code: 'E-1002', start: '19:00', end: '23:30', brk: 30, servicio: 'Cena' },
    { emp_code: 'E-1004', start: '18:30', end: '00:00', brk: 30, servicio: 'Cena' },
    { emp_code: 'E-1003', start: '19:00', end: '00:00', brk: 30, servicio: 'Cena' },
    // Sala · cena
    { emp_code: 'E-1007', start: '19:30', end: '00:30', brk: 30, servicio: 'Cena' },
    { emp_code: 'E-1009', start: '19:30', end: '00:30', brk: 30, servicio: 'Cena' },
    { emp_code: 'E-1010', start: '20:00', end: '00:00', brk: 0,  servicio: 'Cena' },
  ]
  const turno_madnum_domingo: ShiftPlan[] = [
    { emp_code: 'E-1001', start: '12:00', end: '17:00', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-1002', start: '12:00', end: '17:00', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-1003', start: '12:00', end: '17:00', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-1007', start: '12:30', end: '17:00', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-1008', start: '12:30', end: '17:00', brk: 30, servicio: 'Comida' },
  ]
  const turno_bcngr_normal: ShiftPlan[] = [
    { emp_code: 'E-2001', start: '11:00', end: '19:00', brk: 30, servicio: 'All day' },
    { emp_code: 'E-2002', start: '11:00', end: '16:00', brk: 30, servicio: 'Comida' },
    { emp_code: 'E-2003', start: '18:30', end: '23:30', brk: 30, servicio: 'Cena' },
    { emp_code: 'E-2004', start: '12:00', end: '15:00', brk: 0,  servicio: 'Comida' },
    { emp_code: 'E-2004', start: '19:00', end: '23:00', brk: 0,  servicio: 'Cena' },
    { emp_code: 'E-2005', start: '20:00', end: '23:30', brk: 0,  servicio: 'Cena' },
  ]

  function netHrs(start: string, end: string, brk: number): number {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const sMin = sh * 60 + sm
    let eMin = eh * 60 + em
    const overnight = eMin <= sMin
    if (overnight) eMin += 24 * 60
    return Math.max(0, (eMin - sMin - brk)) / 60
  }

  const insertTurno = db.prepare(`
    INSERT INTO turnos (user_id, site_id, employee_id, employee_name, rol, servicio, fecha, start_time, end_time, break_minutes, horas_plan, coste_hora, source, overnight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (let i = 0; i < 21; i++) {
    const fecha = dAgo(i)
    const dow = new Date(fecha).getDay() // 0 dom, 1 lun, ..., 6 sáb
    if (dow === 1) continue // lunes cerrado

    const planMadnum = dow === 0 ? turno_madnum_domingo : turno_madnum_normal
    for (const t of planMadnum) {
      const emp = empleados.find(e => e.employee_id === t.emp_code)!
      const overnight = parseInt(t.end.split(':')[0]) < parseInt(t.start.split(':')[0]) ? 1 : 0
      const h = netHrs(t.start, t.end, t.brk)
      insertTurno.run(uid, 'MADNUM', empIdByCode[t.emp_code], emp.nombre, emp.rol, t.servicio, fecha, t.start, t.end, t.brk, h, emp.coste, 'manual', overnight)
    }
    // BCNGR opera Mar–Dom incluyendo domingos
    if (dow !== 1) {
      for (const t of turno_bcngr_normal) {
        const emp = empleados.find(e => e.employee_id === t.emp_code)!
        const overnight = parseInt(t.end.split(':')[0]) < parseInt(t.start.split(':')[0]) ? 1 : 0
        const h = netHrs(t.start, t.end, t.brk)
        insertTurno.run(uid, 'BCNGR', empIdByCode[t.emp_code], emp.nombre, emp.rol, t.servicio, fecha, t.start, t.end, t.brk, h, emp.coste, 'manual', overnight)
      }
    }
  }

  // ── VENTAS POR FRANJA (últimos 21 días) ───────────────────────────────────
  // Hourly distribution patterns from typical Madrid mid/high-end restaurant.
  // Slots de 30 min: 12:30-13:00, 13:00-13:30 … hasta 16:30; 19:30-20:00 … 23:30
  // BCNGR: solo delivery (más reparto a partir 13:00 y 20:30)

  const slotsComida = [
    ['12:30', '13:00'], ['13:00', '13:30'], ['13:30', '14:00'],
    ['14:00', '14:30'], ['14:30', '15:00'], ['15:00', '15:30'],
    ['15:30', '16:00'], ['16:00', '16:30'],
  ] as const

  const slotsCena = [
    ['20:00', '20:30'], ['20:30', '21:00'], ['21:00', '21:30'],
    ['21:30', '22:00'], ['22:00', '22:30'], ['22:30', '23:00'],
    ['23:00', '23:30'],
  ] as const

  // Distribution multipliers (proporción del servicio en cada slot)
  const distComida: Record<string, number> = {
    '12:30-13:00': 0.05, '13:00-13:30': 0.08, '13:30-14:00': 0.14,
    '14:00-14:30': 0.22, '14:30-15:00': 0.20, '15:00-15:30': 0.15,
    '15:30-16:00': 0.10, '16:00-16:30': 0.06,
  }
  const distCena: Record<string, number> = {
    '20:00-20:30': 0.06, '20:30-21:00': 0.12, '21:00-21:30': 0.18,
    '21:30-22:00': 0.22, '22:00-22:30': 0.18, '22:30-23:00': 0.14,
    '23:00-23:30': 0.10,
  }

  // Base diaria por día de la semana (€ ventas/servicio):
  //   Mar: 1400 / 1700  · Mié: 1500 / 2000 · Jue: 1900 / 2600 · Vie: 2400 / 3400
  //   Sáb: 2800 / 3600  · Dom: 1700 (solo comida)
  const madnumBaseByDow: Record<number, { comida: number; cena: number }> = {
    0: { comida: 1700, cena: 0 },     // Domingo
    2: { comida: 1400, cena: 1700 },  // Martes
    3: { comida: 1500, cena: 2000 },  // Miércoles
    4: { comida: 1900, cena: 2600 },  // Jueves
    5: { comida: 2400, cena: 3400 },  // Viernes
    6: { comida: 2800, cena: 3600 },  // Sábado
  }

  // Dark kitchen BCNGR: solo delivery. Comida más baja, cena equivalente
  const bcngrBaseByDow: Record<number, { comida: number; cena: number }> = {
    0: { comida: 280, cena: 380 },
    2: { comida: 220, cena: 320 },
    3: { comida: 260, cena: 360 },
    4: { comida: 340, cena: 440 },
    5: { comida: 420, cena: 580 },
    6: { comida: 480, cena: 620 },
  }

  // Pseudo-random consistente
  const rand = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
    return x - Math.floor(x)
  }

  const insertVenta = db.prepare(`
    INSERT INTO ventas_franja (user_id, site_id, fecha, timeslot_start, timeslot_end, channel, sales_net, covers, orders, tickets, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (let i = 0; i < 21; i++) {
    const fecha = dAgo(i)
    const dow = new Date(fecha).getDay()
    if (dow === 1) continue // lunes cerrado

    const noise = 0.85 + rand(i + 1) * 0.30  // ±15% diario

    // MADNUM
    const baseM = madnumBaseByDow[dow] || { comida: 1200, cena: 1500 }
    for (const [s, e] of slotsComida) {
      const frac = distComida[`${s}-${e}`] || 0
      const ventas = baseM.comida * frac * noise
      const covers = Math.round((baseM.comida * frac * noise) / 35)  // ticket medio ~35€
      const tickets = Math.max(1, Math.round(covers / 1.8))           // 1.8 covers/ticket
      if (ventas > 0) insertVenta.run(uid, 'MADNUM', fecha, s, e, 'Sala', round2(ventas), covers, null, tickets, 'manual')
    }
    if (baseM.cena > 0) {
      const noiseC = 0.85 + rand(i * 7 + 13) * 0.30
      for (const [s, e] of slotsCena) {
        const frac = distCena[`${s}-${e}`] || 0
        const ventas = baseM.cena * frac * noiseC
        const covers = Math.round(ventas / 42)
        const tickets = Math.max(1, Math.round(covers / 1.9))
        if (ventas > 0) insertVenta.run(uid, 'MADNUM', fecha, s, e, 'Sala', round2(ventas), covers, null, tickets, 'manual')
      }
    }

    // BCNGR (dark kitchen) — delivery only
    const baseB = bcngrBaseByDow[dow] || { comida: 200, cena: 300 }
    const noiseB = 0.80 + rand(i * 11 + 5) * 0.40
    for (const [s, e] of slotsComida) {
      const frac = distComida[`${s}-${e}`] || 0
      const ventas = baseB.comida * frac * noiseB
      const orders = Math.round(ventas / 22)  // ticket medio delivery ~22€
      if (ventas > 0) insertVenta.run(uid, 'BCNGR', fecha, s, e, 'Delivery', round2(ventas), null, orders, orders, 'manual')
    }
    for (const [s, e] of slotsCena) {
      const frac = distCena[`${s}-${e}`] || 0
      const ventas = baseB.cena * frac * noiseB
      const orders = Math.round(ventas / 22)
      if (ventas > 0) insertVenta.run(uid, 'BCNGR', fecha, s, e, 'Delivery', round2(ventas), null, orders, orders, 'manual')
    }
  }

  // ── TARGETS ───────────────────────────────────────────────────────────────
  const targetsRows = [
    // Generales por servicio
    { site_id: null,     servicio: 'All day',  rol: null, splh: 65, labor: 22 },
    { site_id: 'MADNUM', servicio: 'Comida',   rol: null, splh: 75, labor: 20 },
    { site_id: 'MADNUM', servicio: 'Cena',     rol: null, splh: 85, labor: 18 },
    { site_id: 'BCNGR',  servicio: 'All day',  rol: null, splh: 55, labor: 24 },
    { site_id: 'BCNGR',  servicio: 'Comida',   rol: null, splh: 50, labor: 26 },
    { site_id: 'BCNGR',  servicio: 'Cena',     rol: null, splh: 60, labor: 22 },
  ]
  for (const t of targetsRows) {
    db.prepare(`
      INSERT INTO targets_productividad (user_id, site_id, servicio, rol, target_labor_pct, target_splh)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uid, t.site_id, t.servicio, t.rol, t.labor, t.splh)
  }

  // ── REPORTS RECIPIENTS ────────────────────────────────────────────────────
  const recipients = [
    { email: 'steven@myway.es',  nombre: 'Steven Moreno',  role_org: 'CEO',  scope: 'grupo', site_id: null },
    { email: 'lucia@myway.es',   nombre: 'Lucía Vega',     role_org: 'KM',   scope: 'local', site_id: 'MADNUM' },
    { email: 'marc@myway.es',    nombre: 'Marc Puig',      role_org: 'KM',   scope: 'local', site_id: 'BCNGR' },
  ]
  for (const r of recipients) {
    db.prepare(`
      INSERT INTO reports_recipients (user_id, email, nombre, role_in_org, scope, site_id, activo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(uid, r.email, r.nombre, r.role_org, r.scope, r.site_id)
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
