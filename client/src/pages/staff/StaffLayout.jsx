import { Home, Wallet, MapPin } from 'lucide-react'
import { AppShell } from '../../components/AppShell'

// Hinglish nav labels for staff
const NAV = [
  { to: '/staff', label: 'Kaam', icon: Home, end: true },
  { to: '/staff/checkin', label: 'Check-in', icon: MapPin },
  { to: '/staff/ledger', label: 'Paisa', icon: Wallet },
]

export default function StaffLayout() {
  return <AppShell nav={NAV} />
}
