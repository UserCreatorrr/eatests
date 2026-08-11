// Importador de recetarios en Excel → escandallo estructurado.
//
// El formato de partida (Connatura) es una FICHA TÉCNICA con maquetación libre,
// no una tabla plana: hay un bloque de cabecera con etiqueta/valor, una tabla de
// ingredientes con columnas de escalado, y un bloque de procedimiento.
//
// Por eso la detección es por ETIQUETA, no por coordenadas fijas: si el cliente
// mueve una fila o añade una columna, el importador sigue funcionando.

export type Celda = string | number | null | undefined
export type Grid = Celda[][]

export interface LineaImportada {
  nombre: string
  unidad: string | null
  cantidad_bruta: number | null      // lo que se compra/consume → base del coste
  merma_pct: number | null           // % de merma declarado en la ficha
  cantidad_neta: number | null       // lo que acaba en el plato (referencia)
  precio: number | null              // €/unidad si la ficha lo trae
  proveedor: string | null
  alergeno: string | null
  nota: string | null                // función / especificación
}

export interface PasoProcedimiento {
  paso: string | null
  etapa: string | null
  procedimiento: string | null
  tiempo: string | null
  temperatura: string | null
  equipo: string | null
  control: string | null
}

export interface RecetaImportada {
  hoja: string
  nombre: string | null
  codigo: string | null
  familia: string | null
  raciones: number | null
  rendimiento_neto: number | null
  gramos_porcion: number | null
  precio_venta: number | null
  descripcion: string | null
  alergenos: string | null
  conservacion: string | null
  regeneracion: string | null
  observaciones: string | null
  procedimiento: PasoProcedimiento[]
  lineas: LineaImportada[]
  avisos: string[]
}

// ─── Utilidades de texto y número ──────────────────────────────────────────

export function norm(v: Celda): string {
  if (v == null) return ''
  return String(v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

const txt = (v: Celda): string => (v == null ? '' : String(v).trim())

// Números en formato europeo o anglosajón: "1.450,80" · "11,50" · "0.05" · "12 €"
export function num(v: Celda): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  let s = String(v).replace(/[€\s%]/g, '').replace(/[^\d.,-]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ─── Unidades ──────────────────────────────────────────────────────────────

/** Familia física de una unidad, para detectar comparaciones imposibles. */
export function familiaUnidad(u: string | null | undefined): 'masa' | 'volumen' | 'unidad' | null {
  const n = norm(u)
  if (!n) return null
  if (['g', 'gr', 'gramo', 'gramos', 'grs', 'kg', 'kilo', 'kilos', 'kgs', 'mg'].includes(n)) return 'masa'
  if (['ml', 'cc', 'cl', 'l', 'lt', 'litro', 'litros', 'lts'].includes(n)) return 'volumen'
  if (['ud', 'uds', 'u', 'unidad', 'unidades', 'pieza', 'piezas', 'docena', 'manojo', 'bandeja'].includes(n)) return 'unidad'
  return null
}

/** false solo si ambas unidades son conocidas y de familias distintas
 *  (p. ej. receta en gramos contra un ingrediente que se compra por manojo). */
export function unidadesCompatibles(a: string | null | undefined, b: string | null | undefined): boolean {
  const fa = familiaUnidad(a), fb = familiaUnidad(b)
  if (!fa || !fb) return true
  return fa === fb
}

/** Unidad de COMPRA correspondiente a una unidad de receta.
 *  Las fichas expresan cantidades en g/ml pero los precios en €/kg·L·ud, así que
 *  un ingrediente nuevo debe nacer con la unidad del precio, no la de la receta. */
export function unidadBaseCompra(u: string | null | undefined): string {
  switch (familiaUnidad(u)) {
    case 'masa': return 'kg'
    case 'volumen': return 'l'
    case 'unidad': return 'ud'
    default: return (u || 'ud').trim() || 'ud'
  }
}

// La merma puede venir como fracción (0,05) o como porcentaje (5). Normaliza a %.
function mermaPct(v: Celda): number | null {
  const n = num(v)
  if (n == null) return null
  if (n < 0) return null
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10
}

// Una fila donde el MISMO texto se repite en muchas columnas es una banda de
// cabecera/marca (celdas combinadas), no contenido: se ignora al buscar el título.
function esBanner(fila: Celda[]): boolean {
  const vals = fila.map(txt).filter(Boolean)
  if (vals.length < 4) return false
  return new Set(vals.map(norm)).size === 1
}

// ─── Búsqueda por etiqueta ─────────────────────────────────────────────────

/** true si el texto es en sí mismo otra etiqueta/rótulo de sección de la ficha. */
function pareceEtiqueta(v: string): boolean {
  const n = norm(v)
  if (!n) return false
  return ETIQUETAS_CONOCIDAS.some(e => n === e || n.startsWith(e))
}

/** Primer valor no vacío a la derecha de (row, col). Salta celdas combinadas.
 *  Se detiene si encuentra OTRA etiqueta: en una ficha maquetada a dos columnas,
 *  el valor de la etiqueta izquierda nunca es el rótulo de la columna derecha. */
function valorDerecha(grid: Grid, row: number, col: number): string | null {
  const fila = grid[row] || []
  for (let c = col + 1; c < fila.length; c++) {
    const v = txt(fila[c])
    if (!v || norm(v) === norm(fila[col])) continue
    if (pareceEtiqueta(v)) return null
    return v
  }
  return null
}

/** Busca una etiqueta y devuelve su valor (a la derecha, o debajo si no hay). */
export function valorDeEtiqueta(grid: Grid, etiquetas: string[]): string | null {
  const objetivos = etiquetas.map(norm)
  for (let r = 0; r < grid.length; r++) {
    const fila = grid[r] || []
    for (let c = 0; c < fila.length; c++) {
      const celda = norm(fila[c])
      if (!celda) continue
      if (objetivos.some(o => celda === o || celda.startsWith(o))) {
        const derecha = valorDerecha(grid, r, c)
        if (derecha) return derecha
        // Ficha con el valor debajo de la etiqueta
        const abajo = txt((grid[r + 1] || [])[c])
        if (abajo && !objetivos.some(o => norm(abajo).startsWith(o))) return abajo
      }
    }
  }
  return null
}

// ─── Tabla de ingredientes ─────────────────────────────────────────────────

interface MapaColumnas { [clave: string]: number }

/** Localiza la fila de cabecera de la tabla de ingredientes y mapea sus columnas. */
function localizarTablaIngredientes(grid: Grid): { fila: number; cols: MapaColumnas } | null {
  for (let r = 0; r < grid.length; r++) {
    const fila = (grid[r] || []).map(norm)
    const tieneIngrediente = fila.some(v => v === 'ingrediente' || v === 'ingredientes' || v === 'producto')
    const tieneUnidad = fila.some(v => v.startsWith('unidad') || v === 'ud' || v === 'um')
    if (!tieneIngrediente || !tieneUnidad) continue

    const cols: MapaColumnas = {}
    fila.forEach((v, c) => {
      if (!v) return
      if (cols.nombre == null && (v === 'ingrediente' || v === 'ingredientes' || v === 'producto')) cols.nombre = c
      else if (cols.unidad == null && (v.startsWith('unidad') || v === 'ud' || v === 'um')) cols.unidad = c
      else if (cols.merma == null && v.startsWith('merma')) cols.merma = c
      else if (cols.neta == null && v.includes('neta')) cols.neta = c
      else if (cols.bruta == null && v.includes('bruta')) cols.bruta = c
      else if (cols.precio == null && v.startsWith('precio')) cols.precio = c
      else if (cols.coste == null && v.startsWith('coste')) cols.coste = c
      else if (cols.proveedor == null && v.startsWith('proveedor')) cols.proveedor = c
      else if (cols.alergeno == null && v.startsWith('alergeno')) cols.alergeno = c
      else if (cols.nota == null && (v.startsWith('funcion') || v.includes('especificacion') || v.startsWith('observ'))) cols.nota = c
      // Columnas de escalado ("Cantidad 25 p.", "Cantidad 50 p.") → se ignoran:
      // el escandallo guarda el lote base y Marginbite escala solo.
      else if (cols.bruta == null && cols.neta == null && v.startsWith('cantidad') && !/\d/.test(v)) cols.bruta = c
    })
    if (cols.nombre != null) return { fila: r, cols }
  }
  return null
}

function leerLineas(grid: Grid, inicio: number, cols: MapaColumnas): LineaImportada[] {
  const lineas: LineaImportada[] = []
  let vacias = 0
  for (let r = inicio + 1; r < grid.length; r++) {
    const fila = grid[r] || []
    const nombre = txt(fila[cols.nombre])
    if (!nombre) {
      if (++vacias >= 3) break          // fin de tabla tras varias filas en blanco
      continue
    }
    const n = norm(nombre)
    if (n.startsWith('total') || n.startsWith('subtotal')) break   // fila de totales
    if (n.startsWith('procedimiento')) break
    vacias = 0

    const bruta = cols.bruta != null ? num(fila[cols.bruta]) : null
    const neta = cols.neta != null ? num(fila[cols.neta]) : null
    lineas.push({
      nombre,
      unidad: cols.unidad != null ? (txt(fila[cols.unidad]) || null) : null,
      cantidad_bruta: bruta ?? neta,     // sin bruta, la neta es la mejor referencia
      merma_pct: cols.merma != null ? mermaPct(fila[cols.merma]) : null,
      cantidad_neta: neta,
      precio: cols.precio != null ? num(fila[cols.precio]) : null,
      proveedor: cols.proveedor != null ? (txt(fila[cols.proveedor]) || null) : null,
      alergeno: cols.alergeno != null ? (txt(fila[cols.alergeno]) || null) : null,
      nota: cols.nota != null ? (txt(fila[cols.nota]) || null) : null,
    })
  }
  return lineas
}

// ─── Procedimiento ─────────────────────────────────────────────────────────

function leerProcedimiento(grid: Grid): PasoProcedimiento[] {
  for (let r = 0; r < grid.length; r++) {
    const fila = (grid[r] || []).map(norm)
    if (!fila.some(v => v === 'paso') || !fila.some(v => v.startsWith('procedimiento'))) continue

    const c: MapaColumnas = {}
    fila.forEach((v, i) => {
      if (v === 'paso' && c.paso == null) c.paso = i
      else if (v.startsWith('etapa') && c.etapa == null) c.etapa = i
      else if (v.startsWith('procedimiento') && c.proc == null) c.proc = i
      else if (v.startsWith('tiempo') && c.tiempo == null) c.tiempo = i
      else if (v.startsWith('temperatura') && c.temp == null) c.temp = i
      else if (v.startsWith('equipo') && c.equipo == null) c.equipo = i
      else if (v.includes('control') && c.control == null) c.control = i
    })

    const pasos: PasoProcedimiento[] = []
    let vacias = 0
    for (let i = r + 1; i < grid.length; i++) {
      const f = grid[i] || []
      const desc = c.proc != null ? txt(f[c.proc]) : ''
      const paso = c.paso != null ? txt(f[c.paso]) : ''
      if (!desc && !paso) {
        if (++vacias >= 2) break
        continue
      }
      // Fin del bloque: empieza otra sección (Conservación, Regeneración…) o
      // aparece una fila sin descripción cuyo "paso" no es un número de orden.
      if (pareceEtiqueta(paso) || pareceEtiqueta(desc)) break
      if (!desc && num(paso) == null) break
      vacias = 0
      pasos.push({
        paso: paso || null,
        etapa: c.etapa != null ? (txt(f[c.etapa]) || null) : null,
        procedimiento: desc || null,
        tiempo: c.tiempo != null ? (txt(f[c.tiempo]) || null) : null,
        temperatura: c.temp != null ? (txt(f[c.temp]) || null) : null,
        equipo: c.equipo != null ? (txt(f[c.equipo]) || null) : null,
        control: c.control != null ? (txt(f[c.control]) || null) : null,
      })
    }
    return pasos
  }
  return []
}

// ─── Título de la receta ───────────────────────────────────────────────────

const ETIQUETAS_CONOCIDAS = [
  'codigo', 'familia', 'produccion base', 'rendimiento', 'gramos', 'coste',
  'precio', 'food cost', 'alergenos', 'definicion', 'fotografia', 'ingredientes',
  'procedimiento', 'conservacion', 'regeneracion', 'observaciones',
]

function detectarNombre(grid: Grid): string | null {
  for (let r = 0; r < Math.min(grid.length, 14); r++) {
    const fila = grid[r] || []
    if (esBanner(fila)) continue
    const primera = fila.map(txt).find(Boolean)
    if (!primera) continue
    const n = norm(primera)
    if (n.length < 4) continue
    if (ETIQUETAS_CONOCIDAS.some(e => n.startsWith(e))) continue
    if (num(primera) != null) continue
    return primera
  }
  return null
}

// ─── Entrada principal ─────────────────────────────────────────────────────

export function parseRecetaHoja(hoja: string, grid: Grid): RecetaImportada {
  const avisos: string[] = []

  const tabla = localizarTablaIngredientes(grid)
  const lineas = tabla ? leerLineas(grid, tabla.fila, tabla.cols) : []
  if (!tabla) avisos.push('No se ha encontrado la tabla de ingredientes (se busca una fila con "Ingrediente" y "Unidad").')
  else if (lineas.length === 0) avisos.push('Se encontró la tabla de ingredientes pero no tiene filas con datos.')

  const produccion = valorDeEtiqueta(grid, ['produccion base', 'porciones', 'raciones'])
  const raciones = produccion ? num(produccion.replace(/[^\d.,]/g, ' ')) : null

  const precioObjetivo = valorDeEtiqueta(grid, ['precio objetivo / porcion', 'precio objetivo', 'pvp', 'precio de venta'])

  const receta: RecetaImportada = {
    hoja,
    nombre: detectarNombre(grid),
    codigo: valorDeEtiqueta(grid, ['codigo']) || hoja || null,
    familia: valorDeEtiqueta(grid, ['familia', 'categoria']),
    raciones: raciones != null ? Math.round(raciones) : null,
    rendimiento_neto: num(valorDeEtiqueta(grid, ['rendimiento neto', 'rendimiento'])),
    gramos_porcion: num(valorDeEtiqueta(grid, ['gramos / porcion', 'gramos por porcion', 'gramos'])),
    precio_venta: num(precioObjetivo),
    descripcion: valorDeEtiqueta(grid, ['definicion de la elaboracion', 'definicion', 'descripcion']),
    alergenos: valorDeEtiqueta(grid, ['alergenos y restricciones', 'alergenos']),
    conservacion: valorDeEtiqueta(grid, ['conservacion']),
    regeneracion: valorDeEtiqueta(grid, ['regeneracion']),
    observaciones: valorDeEtiqueta(grid, ['observaciones de prueba', 'observaciones']),
    procedimiento: leerProcedimiento(grid),
    lineas,
    avisos,
  }

  if (!receta.nombre) avisos.push('No se ha detectado el nombre de la receta; se puede escribir en la revisión.')
  if (!receta.raciones) avisos.push('No se ha detectado el número de porciones; sin él, el coste por ración no se puede calcular.')
  const sinPrecio = lineas.filter(l => l.precio == null).length
  if (sinPrecio > 0) {
    avisos.push(`${sinPrecio} ingrediente(s) sin precio en el Excel: se tomará el coste del catálogo si el ingrediente ya existe.`)
  }
  const sinCantidad = lineas.filter(l => l.cantidad_bruta == null).length
  if (sinCantidad > 0) avisos.push(`${sinCantidad} ingrediente(s) sin cantidad: revísalos antes de guardar.`)

  return receta
}
