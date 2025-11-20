import { AdminLayout } from '@/components/admin/Layout/AdminLayout'
import '@/styles/admin-variables.css'

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
}

