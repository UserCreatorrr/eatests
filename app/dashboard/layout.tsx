import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex" style={{ backgroundColor: '#f5f2ee', backgroundImage: "url('/logos/GRID_POSITIVIE.png')", backgroundRepeat: 'repeat', backgroundSize: '400px 400px', minHeight: '100vh' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  )
}
