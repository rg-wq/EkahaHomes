import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Wallet, AlertCircle, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

export default function OwnerLedger() {
  const { data: ledgers } = useQuery({
    queryKey: ['all-staff-ledgers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_ledger_view')
        .select('*')
        .order('balance', { ascending: false })
      return data ?? []
    },
  })

  const { data: recentActivity } = useQuery({
    queryKey: ['recent-staff-activity'],
    queryFn: async () => {
      const [adv, exp] = await Promise.all([
        supabase
          .from('staff_advances')
          .select('*, profiles:profiles!staff_advances_staff_id_fkey(full_name)')
          .order('given_at', { ascending: false })
          .limit(10),
        supabase
          .from('staff_expenses')
          .select('*, profiles:profiles!staff_expenses_staff_id_fkey(full_name)')
          .order('logged_at', { ascending: false })
          .limit(10),
      ])
      const merged = [
        ...(adv.data ?? []).map((a) => ({ ...a, _type: 'advance', _date: a.given_at })),
        ...(exp.data ?? []).map((e) => ({ ...e, _type: 'expense', _date: e.logged_at })),
      ].sort((a, b) => (a._date < b._date ? 1 : -1))
      return merged.slice(0, 15)
    },
  })

  const totals = (ledgers ?? []).reduce(
    (acc, s) => ({
      outstanding: acc.outstanding + Number(s.balance),
      advances: acc.advances + Number(s.total_advances),
      spent: acc.spent + Number(s.total_approved_expenses),
      pending: acc.pending + Number(s.pending_amount),
    }),
    { outstanding: 0, advances: 0, spent: 0, pending: 0 },
  )

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Staff Ledger</h2>
        <p className="text-sm text-slate-500">Read-only overview. Manager handles day-to-day.</p>
      </header>

      {/* Top tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Wallet className="h-4 w-4" /> Outstanding
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            ₹{totals.outstanding.toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">advances not yet spent</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">
            ₹{totals.pending.toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">awaiting manager approval</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total advances</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            ₹{totals.advances.toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">all-time given</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Approved spent</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            ₹{totals.spent.toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">flowed to P&L</p>
        </div>
      </div>

      {/* Staff list */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          By staff
        </h3>
        <div className="space-y-2">
          {ledgers?.map((s) => (
            <div key={s.staff_id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{s.full_name}</p>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>Given: ₹{Number(s.total_advances).toFixed(0)}</span>
                  <span>Spent: ₹{Number(s.total_approved_expenses).toFixed(0)}</span>
                  {Number(s.pending_amount) > 0 && (
                    <span className="text-amber-700">₹{Number(s.pending_amount).toFixed(0)} pending</span>
                  )}
                </div>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                ₹{Number(s.balance).toFixed(0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h3>
        <div className="space-y-1">
          {recentActivity?.map((row) => (
            <div
              key={`${row._type}-${row.id}`}
              className="card flex items-center justify-between !py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-slate-900">
                  <span className="font-medium">{row.profiles?.full_name ?? 'Staff'}</span>{' '}
                  <span className="text-slate-500">
                    {row._type === 'advance'
                      ? `received ${row.mode} advance`
                      : `logged ${row.category}`}
                  </span>
                </p>
                <p className="text-xs text-slate-400">{format(new Date(row._date), 'd MMM, h:mm a')}</p>
              </div>
              <p
                className={`shrink-0 font-semibold ${
                  row._type === 'advance' ? 'text-green-700' : 'text-slate-700'
                }`}
              >
                {row._type === 'advance' ? '+' : '-'}₹{Number(row.amount).toFixed(0)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
