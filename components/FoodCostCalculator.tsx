'use client'
// Escandallo de una receta: líneas (ingrediente, elaboración o libre) con
// merma, coste resuelto por el servidor, distribución del coste, producción
// y cierre financiero. Todo pasa por /api/recipes.
import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, num, pct } from '@/lib/format'
import { UNIT_OPTIONS, unitsCompatibleWith } from '@/lib/units-ui'
import { Btn, Field, Input, Note, Select } from './ui'

type Line = { id: number; ingredient_id: number | null; sub_recipe_id: number | null; free_name: string | null; free_unit_cost: number | null; qty: number; unit: string; waste_pct: number; note: string | null; ingredient_name: string | null; ingredient_unit: string | null; ingredient_cost: number | null; sub_recipe_name: string | null; sub_recipe_yield_unit: string | null }
type LineCost = { lineId: number; kind: 'ingredient' | 'preparation' | 'free'; name: string; qty: number; unit: string; wastePct: number; grossQty: number; unitCost: number; cost: number; warning: string | null }
type Cost = { lines: LineCost[]; total: number; perPortion: number; perYieldUnit: number | null; yieldUnit: string | null; salePrice: number | null; foodCostPct: number | null; incomplete: number; cycle: boolean }
type Recipe = { id: number; name: string; kind: 'dish' | 'preparation'; portions: number; yield_qty: number | null; yield_unit: string | null; sale_price: number | null; general_waste_pct: number | null }

const COLORS = ['#19f973', '#c97b3d', '#5b44b8', '#0fa651', '#a83e1e', '#6c635a', '#d4a017']

function badge(p: number) {
  if (p < 28) return { label: 'EXCELENTE', bg: tk.appleSoft, color: tk.appleDeep }
  if (p < 33) return { label: 'ACEPTABLE', bg: tk.claySoft, color: tk.clay }
  if (p < 40) return { label: 'REVISAR', bg: '#fff7ed', color: tk.clay }
  return { label: 'CRÍTICO', bg: tk.terraSoft, color: tk.terra }
}

export default function FoodCostCalculator({ recipeId, onOpenPreparation, onSaved }: { recipeId: number; onOpenPreparation?: (id: number) => void; onSaved?: () => void }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [cost, setCost] = useState<Cost | null>(null)
  const [ings, setIngs] = useState<any[]>([])
  const [preps, setPreps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'catalog' | 'free'>('catalog')
  const [nl, setNl] = useState({ pick: '', freeName: '', qty: '', unit: '', wastePct: '', freeUnitCost: '' })
  // Ficha financiera y producción, editables aquí mismo.
  const [pvp, setPvp] = useState(''), [portions, setPortions] = useState('1'), [isPrep, setIsPrep] = useState(false), [yieldQty, setYieldQty] = useState(''), [yieldUnit, setYieldUnit] = useState('g'), [generalWaste, setGeneralWaste] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [prod, setProd] = useState({ portions: '', consume: false })

  const load = useCallback(async () => {
    try {
      const [r, i, p] = await Promise.all([api.get(`/api/recipes/${recipeId}`), api.get('/api/ingredients'), api.get(`/api/recipes/${recipeId}/preparations`)])
      setRecipe(r.recipe); setLines(r.lines); setCost(r.cost)
      setIngs([...i.data.filter((x: any) => x.cost > 0), ...i.data.filter((x: any) => !(x.cost > 0))]); setPreps(p.data)
      setPvp(r.recipe.sale_price != null ? String(r.recipe.sale_price) : ''); setPortions(String(r.recipe.portions)); setIsPrep(r.recipe.kind === 'preparation')
      setYieldQty(r.recipe.yield_qty != null ? String(r.recipe.yield_qty) : ''); setYieldUnit(r.recipe.yield_unit ?? 'g'); setGeneralWaste(r.recipe.general_waste_pct != null ? String(r.recipe.general_waste_pct) : '')
    } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [recipeId])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMsg(''); try { await fn() } catch (e) { setMsg(errorMessage(e)) } setBusy(false) }
  const refreshLines = async () => { const r = await api.get(`/api/recipes/${recipeId}`); setLines(r.lines); setCost(r.cost) }

  const picked = nl.pick.startsWith('p:') ? { kind: 'prep' as const, item: preps.find(p => String(p.id) === nl.pick.slice(2)) } : nl.pick ? { kind: 'ing' as const, item: ings.find(i => String(i.id) === nl.pick) } : null
  const refUnit = picked?.kind === 'prep' ? picked.item?.yieldUnit : picked?.item?.base_unit
  const unitOptions = mode === 'catalog' && refUnit ? unitsCompatibleWith(refUnit) : UNIT_OPTIONS

  function onPick(v: string) {
    const isPrep = v.startsWith('p:')
    const item = isPrep ? preps.find(p => String(p.id) === v.slice(2)) : ings.find(i => String(i.id) === v)
    const base = isPrep ? item?.yieldUnit : item?.base_unit
    setNl(n => ({ ...n, pick: v, unit: n.unit && unitsCompatibleWith(base).some(u => u.value === n.unit) ? n.unit : (base === 'kg' ? 'g' : base === 'l' ? 'ml' : base ?? '') }))
  }

  const addLine = () => run(async () => {
    const body: any = { qty: Number(nl.qty), unit: nl.unit, wastePct: nl.wastePct === '' ? 0 : Number(nl.wastePct) }
    if (mode === 'free') { body.freeName = nl.freeName || 'Sin nombre'; body.freeUnitCost = nl.freeUnitCost === '' ? null : Number(nl.freeUnitCost) }
    else if (picked?.kind === 'prep') body.subRecipeId = picked.item.id
    else body.ingredientId = Number(nl.pick)
    const r = await api.post(`/api/recipes/${recipeId}/lines`, body)
    setLines(r.lines); setCost(r.cost); setNl({ pick: '', freeName: '', qty: '', unit: '', wastePct: '', freeUnitCost: '' })
  })
  const removeLine = (id: number) => run(async () => { const r = await api.del(`/api/recipes/${recipeId}/lines/${id}`); setCost(r.cost); setLines(ls => ls.filter(l => l.id !== id)) })
  const setWaste = (id: number, v: string) => run(async () => { const n = v === '' ? 0 : Number(v); if (!Number.isFinite(n) || n < 0 || n > 95) return; const r = await api.patch(`/api/recipes/${recipeId}/lines/${id}`, { wastePct: n }); setLines(r.lines); setCost(r.cost) })

  const saveRecipe = () => run(async () => {
    await api.patch(`/api/recipes/${recipeId}`, { salePrice: pvp === '' ? null : Number(pvp), portions: Math.max(1, Math.round(Number(portions) || 1)), kind: isPrep ? 'preparation' : 'dish',
      yieldQty: isPrep && yieldQty !== '' ? Number(yieldQty) : null, yieldUnit: isPrep && yieldQty !== '' ? yieldUnit : null, generalWastePct: generalWaste === '' ? null : Number(generalWaste) })
    await load(); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2500); onSaved?.()
  })
  const registerProduction = () => run(async () => {
    const r = await api.post(`/api/recipes/${recipeId}/production`, { portions: Math.max(1, Math.round(Number(prod.portions))), consumeStock: prod.consume })
    setProd({ portions: '', consume: false }); alert(`Producción registrada${prod.consume ? ` (${r.movements} salidas de stock)` : ''}.`)
  })

  if (loading || !recipe || !cost) return <div style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron60, padding: 24 }}>Cargando…</div>

  const lc = new Map(cost.lines.map(l => [l.lineId, l]))
  const total = cost.total
  const portionsN = Math.max(1, Math.round(Number(portions) || 1))
  const pvpN = pvp !== '' ? Number(pvp) : null
  const perPortion = total / portionsN
  const fc = pvpN && pvpN > 0 ? (perPortion / pvpN) * 100 : null
  const margin = pvpN != null ? pvpN - perPortion : null
  const suggested = perPortion > 0 ? Math.ceil((perPortion / 0.3) * 100) / 100 : null
  const perYield = isPrep && Number(yieldQty) > 0 ? total / Number(yieldQty) : null
  const share = cost.lines.filter(l => l.cost > 0).map(l => ({ id: l.lineId, name: l.name, pct: total > 0 ? (l.cost / total) * 100 : 0 })).sort((a, b) => b.pct - a.pct)
  const warnings = cost.lines.filter(l => l.warning)
  const hasWaste = lines.some(l => l.waste_pct > 0)
  const th: React.CSSProperties = { padding: '6px 10px', fontFamily: ff.mono, fontSize: 10, color: tk.iron40, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', borderBottom: `1px solid ${tk.iron20}` }
  const td: React.CSSProperties = { padding: '8px 10px', fontFamily: ff.mono, fontSize: 12, color: tk.iron, borderBottom: `1px solid ${tk.iron20}` }
  const lab: React.CSSProperties = { fontFamily: ff.mono, fontSize: 10, textTransform: 'uppercase', color: tk.iron40, margin: '0 0 4px', letterSpacing: 1 }
  const big: React.CSSProperties = { fontFamily: ff.display, fontWeight: 700, fontSize: 22, color: tk.iron, margin: 0 }

  return (
    <div style={{ padding: '24px 0 0' }}>
      {msg && <Note tone="crit">{msg}</Note>}
      {cost.cycle && <Note tone="crit">Hay una elaboración que se usa a sí misma. Quita esa línea para que el coste vuelva a cuadrar.</Note>}
      {warnings.length > 0 && <Note tone="warn"><strong>{warnings.length} línea{warnings.length > 1 ? 's' : ''} sin coste, el total está incompleto.</strong>{warnings.slice(0, 4).map(l => <div key={l.lineId}>· {l.name}: {l.warning}</div>)}</Note>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
        <thead><tr>{['Ingrediente', 'Neto', 'Ud.', 'Merma', 'Bruto', '€/ud', 'Subtotal', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {lines.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: tk.iron40, padding: 20 }}>Sin ingredientes. Añade el primero abajo.</td></tr>}
          {lines.map(l => {
            const c = lc.get(l.id)
            const isPrepLine = !!l.sub_recipe_id
            return (
              <tr key={l.id} style={c?.warning ? { background: '#fffaf3' } : undefined}>
                <td style={td}>
                  {c?.name ?? l.ingredient_name ?? l.sub_recipe_name ?? l.free_name}
                  {isPrepLine && <span style={{ marginLeft: 5, fontFamily: ff.mono, fontSize: 9, fontWeight: 700, padding: '1px 5px', background: '#e8e0ff', color: '#5b44b8' }}>elaboración</span>}
                  {isPrepLine && onOpenPreparation && <button onClick={() => onOpenPreparation(l.sub_recipe_id!)} style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#5b44b8', fontFamily: ff.mono, fontSize: 11, padding: 0 }}>ver ›</button>}
                  {l.ingredient_id && <span style={{ marginLeft: 5, fontFamily: ff.mono, fontSize: 9, padding: '1px 5px', background: tk.creamSoft, color: tk.iron60 }}>live</span>}
                  {c?.warning && <span style={{ display: 'block', fontFamily: ff.mono, fontSize: 9.5, color: tk.clay, marginTop: 2 }}>{c.warning}</span>}
                </td>
                <td style={td}>{num(l.qty)}</td>
                <td style={td}>{l.unit}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><input type="number" min={0} max={95} step="0.1" defaultValue={l.waste_pct || 0} onBlur={e => { if (Number(e.target.value || 0) !== (l.waste_pct || 0)) setWaste(l.id, e.target.value) }} style={{ width: 52, fontFamily: ff.mono, fontSize: 11, padding: '3px 5px', border: `1px solid ${tk.iron20}`, background: '#fff' }} /><span style={{ marginLeft: 3, opacity: 0.45 }}>%</span></td>
                <td style={{ ...td, opacity: l.waste_pct > 0 ? 1 : 0.35 }}>{num(c?.grossQty ?? l.qty)}</td>
                <td style={td}>{c && c.unitCost > 0 ? `${eur(c.unitCost)}/${l.unit}` : '—'}</td>
                <td style={{ ...td, fontWeight: 700 }}>{c && c.cost > 0 ? eur(c.cost) : '—'}</td>
                <td style={td}><button onClick={() => removeLine(l.id)} disabled={busy} style={{ background: tk.terraSoft, border: 'none', padding: '3px 8px', cursor: 'pointer', color: tk.terra, fontFamily: ff.mono, fontSize: 12, fontWeight: 700 }}>×</button></td>
              </tr>
            )
          })}
          {lines.length > 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'right', opacity: 0.6 }}>TOTAL</td><td style={{ ...td, fontFamily: ff.display, fontWeight: 700, fontSize: 15, color: tk.appleDeep }}>{eur(total)}</td><td style={td} /></tr>}
        </tbody>
      </table>
      {hasWaste && <p style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron60, margin: '-10px 2px 16px', lineHeight: 1.5 }}>La cantidad neta es la que acaba en el plato. Con la merma, el coste se calcula sobre el bruto, que es lo que sale del almacén.</p>}

      <div style={{ background: tk.paper, padding: 16, marginBottom: 18, border: `1px solid ${tk.iron20}` }}>
        <p style={lab}>Añadir ingrediente o elaboración</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 220px' }}>
            {mode === 'catalog' ? (
              <Select value={nl.pick} onChange={e => e.target.value === '__free__' ? (setMode('free'), setNl(n => ({ ...n, pick: '' }))) : onPick(e.target.value)} style={{ padding: '7px 10px', fontSize: 11 }}>
                <option value="">Seleccionar…</option>
                {preps.length > 0 && <optgroup label="Elaboraciones (salsas, bases, fondos)">{preps.map(p => <option key={`p${p.id}`} value={`p:${p.id}`}>{p.name} — {num(p.yieldQty)} {p.yieldUnit}{p.perYieldUnit != null ? ` · ${eur(p.perYieldUnit)}/${p.yieldUnit}` : ''}</option>)}</optgroup>}
                <optgroup label="Ingredientes">{ings.map(i => <option key={i.id} value={i.id}>{i.name}{i.cost ? ` — ${eur(i.cost)}/${i.base_unit}` : ' (sin coste)'}</option>)}</optgroup>
                <option value="__free__">Ingrediente libre (sin catálogo)</option>
              </Select>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}><Input placeholder="Nombre" value={nl.freeName} onChange={e => setNl(n => ({ ...n, freeName: e.target.value }))} style={{ padding: '7px 10px', fontSize: 11 }} /><Btn small kind="ghost" onClick={() => setMode('catalog')}>LISTA</Btn></div>
            )}
          </div>
          <Input type="number" step="0.001" min={0} placeholder="cant. neta" value={nl.qty} onChange={e => setNl(n => ({ ...n, qty: e.target.value }))} style={{ flex: '0 1 90px', padding: '7px 10px', fontSize: 11 }} />
          <Select value={nl.unit} onChange={e => setNl(n => ({ ...n, unit: e.target.value }))} style={{ flex: '0 1 90px', padding: '7px 10px', fontSize: 11 }}><option value="">unidad…</option>{unitOptions.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}</Select>
          <Input type="number" step="0.1" min={0} max={95} placeholder="merma %" title="Porcentaje que se pierde al limpiar o cocinar" value={nl.wastePct} onChange={e => setNl(n => ({ ...n, wastePct: e.target.value }))} style={{ flex: '0 1 90px', padding: '7px 10px', fontSize: 11 }} />
          {mode === 'free' && <Input type="number" step="0.0001" min={0} placeholder="€/ud" value={nl.freeUnitCost} onChange={e => setNl(n => ({ ...n, freeUnitCost: e.target.value }))} style={{ flex: '0 1 100px', padding: '7px 10px', fontSize: 11 }} />}
          <Btn onClick={addLine} disabled={busy || !nl.qty || !nl.unit || (mode === 'catalog' ? !nl.pick : !nl.freeName)}>+</Btn>
        </div>
      </div>

      {share.length > 0 && total > 0 && (
        <div style={{ background: tk.paper, padding: 16, marginBottom: 18, border: `1px solid ${tk.iron20}` }}>
          <p style={{ ...lab, marginBottom: 10 }}>Distribución del coste</p>
          <div style={{ display: 'flex', height: 18, overflow: 'hidden', border: `1px solid ${tk.iron20}` }}>{share.map((s, i) => <div key={s.id} title={`${s.name}: ${s.pct.toFixed(1)}%`} style={{ width: `${s.pct}%`, background: COLORS[i % COLORS.length] }} />)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>{share.map((s, i) => <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: ff.mono, fontSize: 10.5 }}><span style={{ width: 9, height: 9, background: COLORS[i % COLORS.length] }} />{s.name} <strong>{s.pct.toFixed(1)}%</strong></span>)}</div>
        </div>
      )}

      <div style={{ background: tk.paper, padding: 16, marginBottom: 18, border: `1px solid ${tk.iron20}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: ff.mono, fontSize: 11.5 }}><input type="checkbox" checked={isPrep} onChange={e => setIsPrep(e.target.checked)} /> Es una elaboración intermedia (salsa, fondo, base) que se usa en otras recetas</label>
        {isPrep && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
            <div><p style={lab}>Esta receta produce</p><Input type="number" step="0.001" min={0} placeholder="2000" value={yieldQty} onChange={e => setYieldQty(e.target.value)} style={{ width: 110 }} /></div>
            <Select value={yieldUnit} onChange={e => setYieldUnit(e.target.value)} style={{ width: 100 }}>{UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}</Select>
            {perYield != null && <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, margin: '0 0 8px' }}>Coste: <strong>{eur(perYield)}</strong> por {yieldUnit}</p>}
            {!yieldQty && <p style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.clay, margin: '0 0 8px' }}>Sin cantidad producida no se puede usar en otras recetas.</p>}
          </div>
        )}
      </div>

      <div style={{ background: tk.paper, padding: 20, border: `1px solid ${tk.iron20}`, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 18 }}>
          <div><p style={lab}>PVP / ración (€)</p><Input type="number" step="0.01" min={0} value={pvp} onChange={e => setPvp(e.target.value)} style={{ width: 110, background: '#fff' }} /></div>
          <div><p style={lab}>Raciones</p><Input type="number" step="1" min={1} value={portions} onChange={e => setPortions(e.target.value)} style={{ width: 70, background: '#fff' }} /></div>
          <div><p style={lab}>Merma general %</p><Input type="number" step="0.1" min={0} max={95} value={generalWaste} onChange={e => setGeneralWaste(e.target.value)} title="Sobras o roturas del plato terminado" style={{ width: 80, background: '#fff' }} /></div>
          <Btn onClick={saveRecipe} disabled={busy}>{savedFlash ? '✓ GUARDADO' : 'GUARDAR FICHA'}</Btn>
          {suggested != null && <p style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60, margin: '0 0 8px' }}>PVP sugerido (FC 30%): <strong>{eur(suggested)}</strong></p>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div><p style={lab}>Coste total receta</p><p style={big}>{eur(total)}</p></div>
          <div><p style={lab}>Coste / ración</p><p style={big}>{eur(perPortion)}</p></div>
          {perYield != null && <div><p style={lab}>Coste / {yieldUnit} producido</p><p style={big}>{eur(perYield)}</p></div>}
          {fc != null ? (
            <div><p style={lab}>Food cost %</p><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><p style={big}>{pct(fc)}</p><span style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 700, padding: '3px 8px', background: badge(fc).bg, color: badge(fc).color }}>{badge(fc).label}</span></div></div>
          ) : <div><p style={lab}>Food cost %</p><p style={{ ...big, opacity: 0.4, fontSize: 14 }}>Define el precio de venta para cerrar la rentabilidad</p></div>}
          {margin != null && <div><p style={lab}>Margen bruto / ración</p><p style={{ ...big, color: margin >= 0 ? tk.appleDeep : tk.terra }}>{eur(margin)}{pvpN ? ` (${pct(((pvpN - perPortion) / pvpN) * 100)})` : ''}</p></div>}
        </div>
      </div>

      <div style={{ background: tk.paper, padding: 16, border: `1px solid ${tk.iron20}` }}>
        <p style={lab}>Registrar producción</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input type="number" min={1} step="1" placeholder="raciones" value={prod.portions} onChange={e => setProd(p => ({ ...p, portions: e.target.value }))} style={{ width: 110 }} />
          <label style={{ fontFamily: ff.mono, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={prod.consume} onChange={e => setProd(p => ({ ...p, consume: e.target.checked }))} /> descontar ingredientes del stock</label>
          <Btn kind="ghost" onClick={registerProduction} disabled={busy || !prod.portions}>REGISTRAR</Btn>
          <span style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron40 }}>Alimenta el consumo teórico de Analytics.</span>
        </div>
      </div>
    </div>
  )
}
