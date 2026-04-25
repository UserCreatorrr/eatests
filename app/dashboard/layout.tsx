import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#dfd5c9', padding: 10, overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flex: 1, borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.12)' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', backgroundColor: '#f5f2ee' }}>{children}</main>
      </div>
    </div>
  )
}
