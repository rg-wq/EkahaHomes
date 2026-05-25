import { LayoutDashboard, ListChecks, Boxes, Wallet, Receipt, Users } from 'lucide-react'
import { AppShell } from '../../components/AppShell'

const NAV = [
  { to: '/owner', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/owner/templates', label: 'Templates', icon: ListChecks },
  { to: '/owner/inventory', label: 'Inventory', icon: Boxes },
  { to: '/owner/expenses', label: 'Expenses', icon: Receipt },
  { to: '/owner/ledger', label: 'Ledger', icon: Wallet },
  { to: '/owner/staff', label: 'Staff', icon: Users },
]

export default function OwnerLayout() {
  return <AppShell nav={NAV} />
}
