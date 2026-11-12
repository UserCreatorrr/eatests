'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, fecha, num, pct } from '@/lib/format'
import { Badge, Delta, Empty, Loading, Note, Page, Panel, Stat, Table, Td, Tr } from '@/components/ui'

const MESES: Record<string, string> = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' }
const mes = (ym: string) => { const p = ym?.split('-'); return p?.length >= 2 ? `${MESES[p[1]] || p[1]} ${p[0].slice(2)}` : ym }
const PIE = ['#19f973', '#3d3834', '#0fa651', '#9a8f82', '#c97b3d', '#6c635a', '#a83e1e', '#c4b8a8']
const tip = { fontFamily: 'DM Mono, monospace', fontSize: 11, borderRadius: 0, border: `1px solid ${tk.iron20}` }

function TabResumen() {
  const [d, setD] = useState<any>(null)
  useEffect(() => { api.get('/api/analytics/dashboard').then(setD).catch(() => setD({})) }, [])
  if (!d) return <Loading />
  const k = d.kpis ?? {}
  const variation = k.spendLastMonth > 0 ? Math.round(((k.spendThisMonth - k.spendLastMonth) / k.spendLastMonth) * 100) : null
  const topMax = d.topSuppliers?.[0]?.total ?? 1
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Gasto este mes (facturas)" value={eur(k.spendThisMonth)} sub={variation != null ? <Delta pct={variation} /> : 'sin mes anterior'} />
        <Stat label="Facturas pendientes" value={d.invoiceStats?.pending ?? 0} sub={d.invoiceStats?.pendingAmount ? `por valor de ${eur(d.invoiceStats.pendingAmount)}` : undefined} tone={d.invoiceStats?.pending ? 'warn' : undefined} />
        <Stat label="Ingredientes sin coste" value={<>{k.ingredientsWithoutCost} <span style={{ fontSize: 16, opacity: 0.4 }}>/ {k.ingredients}</span></>} sub={<Link href="/dashboard/ingredientes?filtro=sin_coste" style={{ color: tk.appleDeep, fontWeight: 600 }}>Completar →</Link>} tone={k.ingredientsWithoutCost ? 'warn' : 'ok'} />
        <Stat label="Recetas activas" value={k.activeRecipes} sub={<Link href="/dashboard/sangrado" style={{ color: tk.appleDeep, fontWeight: 600 }}>Ver recetas →</Link>} />
      </div>
      <Panel title="Gasto en compras · últimos 12 meses (facturas)">
        <div style={{ padding: 16 }}>
          {!d.spendMonthly?.length ? <Empty>Sin facturas registradas.</Empty> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.spendMonthly.map((x: any) => ({ ...x, m: mes(x.month) }))}>
                <XAxis dataKey="m" tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: tk.iron60 } as any} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: tk.iron60 } as any} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`} width={48} />
                <Tooltip formatter={(v: any) => eur(v)} contentStyle={tip} />
                <Bar dataKey="total" fill={tk.apple} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Panel title="Gasto por proveedor este mes">
          <div style={{ padding: 16 }}>
            {!d.spendBySupplierThisMonth?.length ? <Empty>Sin facturas este mes.</Empty> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={d.spendBySupplierThisMonth} dataKey="total" nameKey="name" cx="50%" cy="45%" outerRadius={85} paddingAngle={2}>{d.spendBySupplierThisMonth.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie>
                  <Legend formatter={v => <span style={{ fontFamily: 'DM Mono', fontSize: 11 }}>{v}</span>} /><Tooltip formatter={(v: any) => eur(v)} contentStyle={tip} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <Panel title="Top proveedores (histórico)">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!d.topSuppliers?.length ? <Empty>Sin datos.</Empty> : d.topSuppliers.map((p: any) => (
              <div key={p.id}><div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ff.mono, fontSize: 11.5, marginBottom: 4 }}><Link href={`/dashboard/proveedores/${p.id}`} style={{ color: tk.iron, textDecoration: 'none' }}>{p.name}</Link><span>{eur(p.total)} · {p.invoices} fact.</span></div><div style={{ height: 6, background: tk.creamSoft }}><div style={{ width: `${(p.total / topMax) * 100}%`, height: '100%', background: tk.apple }} /></div></div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}

function TabDesviaciones() {
  const [d, setD] = useState<any>(null)
  const [sub, setSub] = useState<'todas' | 'subidas' | 'bajadas' | 'proveedores' | 'inconsistencias'>('todas')
  useEffect(() => { api.get('/api/analytics/deviations').then(setD).catch(() => setD({ deviations: [], inconsistencies: [], supplierTrend: [] })) }, [])
  if (!d) return <Loading />
  const dev: any[] = d.deviations, inc: any[] = d.inconsistencies, trend: any[] = d.supplierTrend
  const list = sub === 'subidas' ? dev.filter(x => x.changePct > 0) : sub === 'bajadas' ? dev.filter(x => x.changePct < 0) : dev
  const tabs = [['todas', 'Todas', dev.length], ['subidas', 'Subidas', dev.filter(x => x.changePct > 0).length], ['bajadas', 'Bajadas', dev.filter(x => x.changePct < 0).length], ['proveedores', 'Por proveedor', trend.length], ['inconsistencias', 'Entre proveedores', inc.length]] as const
  return (
    <>
      <div style={{ display: 'flex', gap: 0, border: `1.5px solid ${tk.iron}`, width: 'fit-content', marginBottom: 16 }}>{tabs.map(([k, l, n]) => <button key={k} onClick={() => setSub(k)} style={{ padding: '7px 14px', background: sub === k ? tk.iron : tk.paper, color: sub === k ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11 }}>{l} · {n}</button>)}</div>
      {!dev.length && !inc.length && !trend.length && <Note>Las desviaciones aparecen cuando hay al menos dos precios registrados de un ingrediente con el mismo proveedor (albaranes validados o precios a mano).</Note>}
      {(sub === 'todas' || sub === 'subidas' || sub === 'bajadas') && (
        <Panel title="Último precio frente al anterior del mismo proveedor">
          {!list.length ? <Empty>Sin desviaciones.</Empty> : (
            <Table head={['Ingrediente', 'Proveedor', 'Fecha', 'Anterior', 'Actual', 'Variación', 'Impacto mensual', 'Nivel']} right={[3, 4, 5, 6]}>
              {list.map((x: any) => <Tr key={x.ingredientId}><Td><Link href={`/dashboard/ingredientes/${x.ingredientId}`} style={{ color: tk.iron, textDecoration: 'none', borderBottom: `1px solid ${tk.iron40}` }}>{x.name}</Link></Td><Td style={{ color: tk.iron60 }}>{x.supplier || '—'}</Td><Td>{fecha(x.observedOn)}</Td><Td right>{eur(x.previous)}/{x.unit}</Td><Td right style={{ fontWeight: 600 }}>{eur(x.current)}/{x.unit}</Td><Td right><Delta pct={x.changePct} /></Td><Td right>{x.monthlyImpact != null ? `${x.monthlyImpact > 0 ? '+' : ''}${eur(x.monthlyImpact)}` : '—'}</Td><Td><Badge tone={x.level === 'high' ? 'crit' : x.level === 'medium' ? 'warn' : 'neutral'}>{x.level === 'high' ? 'alta' : x.level === 'medium' ? 'media' : 'baja'}</Badge></Td></Tr>)}
            </Table>
          )}
        </Panel>
      )}
      {sub === 'proveedores' && (
        <Panel title="Gasto por proveedor: este mes frente al anterior (albaranes validados)">
          {!trend.length ? <Empty>Sin variaciones relevantes (≥ 5%) o sin datos de dos meses seguidos.</Empty> : (
            <Table head={['Proveedor', 'Mes anterior', 'Este mes', 'Variación', '€']} right={[1, 2, 3, 4]}>
              {trend.map((v: any) => <Tr key={v.id}><Td><Link href={`/dashboard/proveedores/${v.id}`} style={{ color: tk.iron, textDecoration: 'none' }}>{v.name}</Link></Td><Td right>{eur(v.lastMonth)}</Td><Td right style={{ fontWeight: 600 }}>{eur(v.thisMonth)}</Td><Td right><Delta pct={v.changePct} /></Td><Td right>{v.changeEur > 0 ? '+' : ''}{eur(v.changeEur)}</Td></Tr>)}
            </Table>
          )}
        </Panel>
      )}
      {sub === 'inconsistencias' && (
        <Panel title="Mismo ingrediente, distinto precio según proveedor (en unidad base)">
          {!inc.length ? <Empty>No se detectan diferencias de precio entre proveedores.</Empty> : (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {inc.map((i: any) => (
                <div key={i.ingredientId} style={{ border: `1.5px solid ${tk.iron20}`, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}><strong style={{ fontFamily: ff.display, fontSize: 14 }}>{i.name}</strong><Badge tone={i.diffPct >= 20 ? 'crit' : 'warn'}>+{i.diffPct}%</Badge></div>
                  {[...i.suppliers].sort((a, b) => a.pricePerBase - b.pricePerBase).map((s: any, j: number) => <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ff.mono, fontSize: 11.5, padding: '3px 0', color: j === 0 ? tk.appleDeep : tk.iron }}><span>{s.supplier} <span style={{ color: tk.iron40 }}>{fecha(s.date)}</span></span><span>{eur(s.pricePerBase)}/{i.baseUnit}</span></div>)}
                  <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60, marginTop: 6 }}>Ahorro potencial: {eur(i.potentialSaving)}/{i.baseUnit}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </>
  )
}

function TabConsumo() {
  const [d, setD] = useState<any>(null)
  const ym = new Date().toISOString().slice(0, 7)
  useEffect(() => { api.get(`/api/analytics/consumption?month=${ym}`).then(setD).catch(() => setD({ byRecipe: [], comparison: [] })) }, [ym])
  if (!d) return <Loading />
  return (
    <>
      <Note>Registra las raciones producidas desde el escandallo de cada receta. La app explota la receta (elaboraciones incluidas, en unidad base) y compara el consumo teórico con lo comprado en el mes.</Note>
      {!d.hasProduction ? <Empty>Sin producción registrada en {mes(ym)}. Hazlo desde Escandallo › receta › Registrar producción.</Empty> : (
        <>
          <Panel title={`Producción registrada · ${mes(ym)}`}>
            <Table head={['Receta', 'Raciones', 'Food cost', 'Ingredientes explotados']} right={[1, 2]}>
              {d.byRecipe.map((r: any) => <Tr key={r.recipeId}><Td><Link href={`/dashboard/sangrado?receta=${r.recipeId}`} style={{ color: tk.iron, textDecoration: 'none', borderBottom: `1px solid ${tk.iron40}` }}>{r.name}</Link></Td><Td right>{r.portions}</Td><Td right>{pct(r.foodCostPct)}</Td><Td style={{ color: tk.iron60 }}>{r.items.map((i: any) => `${i.name} ${num(i.qty)} ${i.unit}`).join(' · ')}</Td></Tr>)}
            </Table>
          </Panel>
          <Panel title="Consumo teórico frente a compras recibidas (unidad base)">
            <Table head={['Ingrediente', 'Teórico', 'Comprado', 'Diferencia', 'Coste comprado']} right={[1, 2, 3, 4]}>
              {d.comparison.map((c: any) => <Tr key={c.ingredientId}><Td>{c.name}{c.note && <div style={{ fontSize: 10, color: tk.iron40 }}>{c.note}</div>}</Td><Td right>{num(c.theoretical)} {c.unit}</Td><Td right>{c.purchased != null ? `${num(c.purchased)} ${c.unit}` : '—'}</Td><Td right style={{ fontWeight: 600, color: c.difference == null ? tk.iron40 : c.difference < 0 ? tk.terra : tk.iron }}>{c.difference != null ? `${c.difference > 0 ? '+' : ''}${num(c.difference)} ${c.unit}` : '—'}</Td><Td right>{eur(c.purchasedCost)}</Td></Tr>)}
            </Table>
            <div style={{ padding: '10px 16px', fontFamily: ff.mono, fontSize: 10.5, color: tk.iron40 }}>Diferencia negativa: se consumió más de lo comprado este mes (stock anterior o merma). Positiva: se compró más de lo que piden las recetas.</div>
          </Panel>
        </>
      )}
    </>
  )
}

const TABS = [['resumen', 'Resumen'], ['desviaciones', 'Desviaciones de precio'], ['consumo', 'Consumo teórico']] as const

export default function AnalyticsPage() {
  const [tab, setTab] = useState<'resumen' | 'desviaciones' | 'consumo'>('resumen')
  return (
    <Page eyebrow="Analytics" title="Analytics" subtitle="Una sola definición de gasto: facturas de compra. Los albaranes validados alimentan precios y consumo.">
      <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}`, width: 'fit-content', marginBottom: 18 }}>{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '9px 18px', background: tab === k ? tk.iron : tk.paper, color: tab === k ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</button>)}</div>
      {tab === 'resumen' && <TabResumen />}{tab === 'desviaciones' && <TabDesviaciones />}{tab === 'consumo' && <TabConsumo />}
    </Page>
  )
}
