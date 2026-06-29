// Master data estándar (feedback QA): categorías y almacenes consistentes en
// toda la app — ingredientes, merma, seed — para evitar "datos sucios".

// Categorías base de ingrediente (familia). Desplegable, NO texto libre.
export const CATEGORIAS_INGREDIENTE = [
  'Carnes',
  'Pescados y mariscos',
  'Frutas y verduras',
  'Lácteos',
  'Secos / despensa',
  'Panadería',
  'Bebidas',
  'Salsas / condimentos',
  'Packaging',
  'Limpieza / no food',
  'Otros',
] as const

// Ubicaciones reales de almacén. (Feedback: "cocina caliente/fría no son
// almacenes, son áreas de producción" — fuera.)
export const ALMACENES = [
  'Almacén seco',
  'Nevera',
  'Congelador',
  'Barra',
  'Bodega / Bebidas',
  'Packaging / no food',
  'Otros',
] as const

// IVA típico en hostelería España (%). 10 = reducido (alimentación/restauración),
// 21 = general (bebidas alcohólicas, limpieza, packaging), 4 = superreducido (pan, leche).
export const TIPOS_IVA = [4, 10, 21] as const

// Mapea las familias antiguas del seed a las categorías estándar nuevas.
export function categoriaEstandar(tipoViejo: string | null | undefined): string {
  const t = (tipoViejo || '').toLowerCase()
  if (/pescado|marisco/.test(t)) return 'Pescados y mariscos'
  if (/carne|charcuter|ternera|cerdo|pollo|ave/.test(t)) return 'Carnes'
  if (/verdura|fruta|hortaliza|hongo|seta|hierba/.test(t)) return 'Frutas y verduras'
  if (/lácteo|lacteo|queso|nata|leche|mantequilla/.test(t)) return 'Lácteos'
  if (/pan|boller|repost/.test(t)) return 'Panadería'
  if (/bebida|vino|licor|refresco|agua|cerveza/.test(t)) return 'Bebidas'
  if (/salsa|condimento|especia|aceite|vinagre/.test(t)) return 'Salsas / condimentos'
  if (/packaging|envase|embalaje/.test(t)) return 'Packaging'
  if (/limpieza|no food|químic/.test(t)) return 'Limpieza / no food'
  if (/seco|harina|cereal|legumbre|conserva|pasta|arroz|azúcar|azucar/.test(t)) return 'Secos / despensa'
  return 'Otros'
}

// Almacén por defecto según categoría estándar.
export function almacenPorCategoria(categoria: string): string {
  switch (categoria) {
    case 'Pescados y mariscos':
    case 'Carnes':
    case 'Lácteos':
    case 'Frutas y verduras': return 'Nevera'
    case 'Bebidas': return 'Bodega / Bebidas'
    case 'Packaging': return 'Packaging / no food'
    case 'Limpieza / no food': return 'Packaging / no food'
    case 'Panadería':
    case 'Secos / despensa':
    case 'Salsas / condimentos': return 'Almacén seco'
    default: return 'Almacén seco'
  }
}

// IVA por defecto según categoría.
export function ivaPorCategoria(categoria: string): number {
  if (categoria === 'Bebidas') return 21          // alcohólicas/refrescos → general (simplificación MVP)
  if (categoria === 'Limpieza / no food' || categoria === 'Packaging') return 21
  if (categoria === 'Panadería') return 4         // pan común → superreducido
  return 10                                         // alimentación general → reducido
}
