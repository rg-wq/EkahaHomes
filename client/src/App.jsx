import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Inventory from './pages/Inventory'
import Laundry from './pages/Laundry'
import LaundryNew from './pages/LaundryNew'
import LaundryDetail from './pages/LaundryDetail'

import OwnerLayout from './pages/owner/OwnerLayout'
import OwnerDashboard from './pages/owner/Dashboard'
import Templates from './pages/owner/Templates'
import TemplateEditor from './pages/owner/TemplateEditor'
import OwnerLedger from './pages/owner/OwnerLedger'

import ManagerLayout from './pages/manager/ManagerLayout'
import ManagerHome from './pages/manager/Home'
import AssignJob from './pages/manager/AssignJob'
import QC from './pages/manager/QC'
import QCReview from './pages/manager/QCReview'
import StaffLedger from './pages/manager/StaffLedger'
import StaffLedgerDetail from './pages/manager/StaffLedgerDetail'

import StaffLayout from './pages/staff/StaffLayout'
import StaffHome from './pages/staff/Home'
import CheckIn from './pages/staff/CheckIn'
import Checklist from './pages/staff/Checklist'
import LogExpense from './pages/staff/LogExpense'
import MyLedger from './pages/staff/MyLedger'

function Placeholder({ title }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">Module under construction.</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route
          path="/owner"
          element={
            <ProtectedRoute allow={['owner']}>
              <OwnerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OwnerDashboard />} />
          <Route path="templates" element={<Templates />} />
          <Route path="templates/new" element={<TemplateEditor />} />
          <Route path="templates/:id" element={<TemplateEditor />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="ledger" element={<OwnerLedger />} />
          <Route path="laundry" element={<Laundry basePath="/owner/laundry" />} />
          <Route path="laundry/new" element={<LaundryNew basePath="/owner/laundry" />} />
          <Route path="laundry/:id" element={<LaundryDetail basePath="/owner/laundry" />} />
          <Route path="staff" element={<Placeholder title="Staff" />} />
        </Route>

        <Route
          path="/manager"
          element={
            <ProtectedRoute allow={['manager']}>
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ManagerHome />} />
          <Route path="qc" element={<QC />} />
          <Route path="qc/:jobId" element={<QCReview />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="laundry" element={<Laundry basePath="/manager/laundry" />} />
          <Route path="laundry/new" element={<LaundryNew basePath="/manager/laundry" />} />
          <Route path="laundry/:id" element={<LaundryDetail basePath="/manager/laundry" />} />
          <Route path="ledger" element={<StaffLedger />} />
          <Route path="ledger/:staffId" element={<StaffLedgerDetail />} />
          <Route path="assign-job" element={<AssignJob />} />
        </Route>

        <Route
          path="/staff"
          element={
            <ProtectedRoute allow={['staff']}>
              <StaffLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StaffHome />} />
          <Route path="checkin" element={<CheckIn />} />
          <Route path="checklist/:jobId" element={<Checklist />} />
          <Route path="laundry" element={<Laundry basePath="/staff/laundry" hinglish />} />
          <Route path="laundry/new" element={<LaundryNew basePath="/staff/laundry" hinglish />} />
          <Route path="laundry/:id" element={<LaundryDetail basePath="/staff/laundry" hinglish />} />
          <Route path="expense" element={<LogExpense />} />
          <Route path="ledger" element={<MyLedger />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
