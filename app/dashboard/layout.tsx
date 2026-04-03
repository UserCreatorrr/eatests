import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex" style={{ backgroundColor: '#f5f2ee', minHeight: '100vh' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  )
}
