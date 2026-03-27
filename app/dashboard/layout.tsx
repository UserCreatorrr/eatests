import Sidebar from '@/components/Sidebar'
import AIChatPanel from '@/components/AIChatPanel'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f5f2ee' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
      <AIChatPanel />
    </div>
  )
}
