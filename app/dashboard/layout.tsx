import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex" style={{ backgroundColor: '#f5f2ee', minHeight: '100vh' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-hidden" style={{ position: 'relative' }}>
        <div style={{
          position: 'fixed', inset: 0, left: '240px',
          backgroundImage: "url('/logos/GRID_POSITIVIE.png')",
          backgroundRepeat: 'repeat', backgroundSize: '400px 400px',
          opacity: 0.03, pointerEvents: 'none', zIndex: 0,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </main>
    </div>
  )
}
