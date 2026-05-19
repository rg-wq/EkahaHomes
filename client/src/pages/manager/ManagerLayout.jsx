import { Home, ClipboardCheck, Boxes, Wallet } from 'lucide-react'
import { AppShell } from '../../components/AppShell'

const NAV = [
  { to: '/manager', label: 'Home', icon: Home, end: true },
  { to: '/manager/qc', label: 'QC', icon: ClipboardCheck },
  { to: '/manager/inventory', label: 'Inventory', icon: Boxes },
  { to: '/manager/ledger', label: 'Staff $', icon: Wallet },
]

export default function ManagerLayout() {
  return <AppShell nav={NAV} />
}
