import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Wallet, ArrowDownCircle, ArrowUpCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORY_HI = {
  supplies: 'Saamaan',
  travel: 'Travel',
  food: 'Khaana',
  other: 'Aur kuch',
  maintenance: 'Repair',
  utilities: 'Bill',
  laundry: 'Laundry',
  staff: 'Staff',
}

const STATUS_HI = {
  pending: { label: 'Manager review mein', color: 'bg-amber-100 text-amber-800' },
  approved: { label: 'OK ho gaya', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Wapas hua', color: 'bg-red-100 text-red-800' },
}

export default function MyLedger() {
  const { user } = useAuth()

  const { data: ledger } = useQuery({
    queryKey: ['my-ledger', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_ledger_view')
        .select('*')
        .eq('staff_id', user.id)
        .single()
      return data
    },
  })

  const { data: advances } = useQuery({
    queryKey: ['my-advances', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_advances')
        .select('*')
        .eq('staff_id', user.id)
        .order('given_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
  })

  const { data: expenses } = useQuery({
    queryKey: ['my-expenses', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_expenses')
        .select('*')
        .eq('staff_id', user.id)
        .order('spent_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
  })

  // Merge into one timeline
  const timeline = [
    ...(advances ?? []).map((a) => ({ ...a, _type: 'advance', _date: a.given_at })),
    ...(expenses ?? []).map((e) => ({ ...e, _type: 'expense', _date: e.spent_at })),
  ].sort((a, b) => (a._date < b._date ? 1 : -1))

  return (
    <div className="space-y-5 pb-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Mera paisa</h2>
        <p className="text-sm text-slate-500">Aapka balance aur kharche</p>
      </section>

      {/* Balance card */}
      <div className="card bg-gradient-to-br from-brand-50 to-white">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-700">
          <Wallet className="h-4 w-4" />
          Balance
        </div>
        <p className="mt-2 text-3xl font-bold text-slate-900">
          ₹{Number(ledger?.balance ?? 0).toFixed(0)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-slate-500">Mila</p>
            <p className="font-semibold text-slate-900">
              ₹{Number(ledger?.total_advances ?? 0).toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Kharch</p>
            <p className="font-semibold text-slate-900">
              ₹{Number(ledger?.total_approved_expenses ?? 0).toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Review</p>
            <p className="font-semibold text-amber-700">
              ₹{Number(ledger?.pending_amount ?? 0).toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      <Link to="/staff/expense" className="btn-primary w-full">
        <Plus className="h-4 w-4" />
        Naya kharcha
      </Link>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          History
        </h3>
        <div className="space-y-2">
          {timeline.length === 0 && (
            <div className="card text-center text-sm text-slate-500">
              Abhi koi entry nahi. Naya kharcha button dabaiye.
            </div>
          )}
          {timeline.map((row) => (
            <div key={`${row._type}-${row.id}`} className="card">
              {row._type === 'advance' ? (
                <div className="flex items-start gap-3">
                  <ArrowDownCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-slate-900">Advance mila</p>
                      <p className="font-semibold text-green-700">+₹{Number(row.amount).toFixed(0)}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {format(new Date(row.given_at), 'd MMM')} · {row.mode}
                      {row.note ? ` · ${row.note}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{row.description}</p>
                        <p className="text-xs text-slate-500">
                          {CATEGORY_HI[row.category] ?? row.category} ·{' '}
                          {format(new Date(row.spent_at), 'd MMM')}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900">-₹{Number(row.amount).toFixed(0)}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_HI[row.status]?.color ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_HI[row.status]?.label ?? row.status}
                      </span>
                      {row.status === 'rejected' && row.reject_reason && (
                        <span className="text-xs text-red-700">— {row.reject_reason}</span>
                      )}
                      {row.receipt_url && (
                        <a
                          href={row.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline"
                        >
                          Receipt
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
