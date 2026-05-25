import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, ClipboardCheck, Wallet, Receipt } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default function ManagerHome() {
  const { profile } = useAuth()

  const { data: pendingQC } = useQuery({
    queryKey: ['pending-qc'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('pending_qc_jobs_view')
        .select('*', { count: 'exact', head: false })
      if (error) throw error
      return { rows: data, count }
    },
  })

  const { data: pendingExp } = useQuery({
    queryKey: ['pending-expenses'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('staff_expenses')
        .select('id, amount, staff_id', { count: 'exact' })
        .eq('status', 'pending')
      if (error) throw error
      return {
        rows: data,
        count: count ?? 0,
        total: (data ?? []).reduce((s, r) => s + Number(r.amount), 0),
      }
    },
  })

  const { data: activeJobs } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: async () => {
      const { data, count } = await supabase
        .from('hk_jobs')
        .select('id, property_id, status', { count: 'exact' })
        .in('status', ['assigned', 'in_progress'])
      return { rows: data, count: count ?? 0 }
    },
  })

  const { data: monthExp } = useQuery({
    queryKey: ['expenses-month-total'],
    queryFn: async () => {
      const from = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const to = format(endOfMonth(new Date()), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('expenses')
        .select('amount')
        .gte('spent_at', from)
        .lte('spent_at', to)
      return (data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    },
  })

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          Good day, {profile?.full_name?.split(' ')[0]}
        </h2>
        <p className="text-sm text-slate-500">Today's queue</p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Link to="/manager/qc" className="card transition active:bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">QC pending</p>
            <ClipboardCheck className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingQC?.count ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">to review</p>
        </Link>

        <Link to="/manager/ledger" className="card transition active:bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Staff $</p>
            <Wallet className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingExp?.count ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">
            {pendingExp?.total ? `₹${pendingExp.total.toFixed(0)} pending` : 'no expenses'}
          </p>
        </Link>

        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Jobs in progress</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeJobs?.count ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">assigned + working</p>
        </div>

        <Link to="/manager/expenses" className="card transition active:bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Expenses (mo)</p>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            ₹{(monthExp ?? 0).toFixed(0)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{format(new Date(), 'MMM yyyy')}</p>
        </Link>
      </div>

      <div>
        <Link to="/manager/assign-job" className="btn-primary w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Assign housekeeping job
        </Link>
      </div>
    </div>
  )
}
