import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { CheckCircle2, ChevronRight, ThumbsDown, Wallet } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORY_LABELS = {
  supplies: 'Supplies',
  travel: 'Travel',
  food: 'Food',
  other: 'Other',
  maintenance: 'Maintenance',
  utilities: 'Utilities',
  laundry: 'Laundry',
  staff: 'Staff',
}

export default function StaffLedger() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

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

  const { data: pending } = useQuery({
    queryKey: ['pending-expenses-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_expenses')
        .select('*, profiles!staff_expenses_staff_id_fkey(full_name)')
        .eq('status', 'pending')
        .order('logged_at', { ascending: true })
      return data ?? []
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from('staff_expenses')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-expenses-all'] })
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['all-staff-ledgers'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const { error } = await supabase
        .from('staff_expenses')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          reject_reason: reason,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-expenses-all'] })
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['all-staff-ledgers'] })
      setRejectingId(null)
      setRejectReason('')
    },
  })

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Staff Ledger</h2>
        <p className="text-sm text-slate-500">Pending approvals + per-staff balance</p>
      </header>

      {pending && pending.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-800">
            Pending approvals ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((e) => (
              <div key={e.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {e.profiles?.full_name ?? 'Staff'} — {CATEGORY_LABELS[e.category]}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">{e.description}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {format(new Date(e.spent_at), 'd MMM')}
                      {e.property_id ? ` · ${e.property_id}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-semibold text-slate-900">
                    ₹{Number(e.amount).toFixed(0)}
                  </p>
                </div>

                {e.receipt_url && (
                  <a
                    href={e.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block overflow-hidden rounded-md ring-1 ring-slate-200"
                  >
                    <img src={e.receipt_url} alt="receipt" className="h-32 w-full object-cover" />
                  </a>
                )}

                {rejectingId === e.id ? (
                  <div className="mt-3 space-y-2">
                    <input
                      className="input text-sm"
                      placeholder="Reason for rejection"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setRejectingId(null)
                          setRejectReason('')
                        }}
                        className="btn-secondary flex-1 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ id: e.id, reason: rejectReason })}
                        className="btn flex-1 bg-red-600 text-sm text-white hover:bg-red-700"
                        disabled={!rejectReason.trim() || rejectMutation.isPending}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setRejectingId(e.id)}
                      className="btn-secondary flex-1 text-sm text-red-600"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => approveMutation.mutate({ id: e.id })}
                      className="btn flex-1 bg-green-600 text-sm text-white hover:bg-green-700"
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          All staff
        </h3>
        <div className="space-y-2">
          {ledgers?.map((s) => (
            <Link
              key={s.staff_id}
              to={`/manager/ledger/${s.staff_id}`}
              className="card flex items-center justify-between transition active:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{s.full_name}</p>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>
                    Advances: <strong className="text-slate-900">₹{Number(s.total_advances).toFixed(0)}</strong>
                  </span>
                  <span>
                    Spent: <strong className="text-slate-900">₹{Number(s.total_approved_expenses).toFixed(0)}</strong>
                  </span>
                  {Number(s.pending_amount) > 0 && (
                    <span className="text-amber-700">
                      ₹{Number(s.pending_amount).toFixed(0)} pending
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-900">
                  ₹{Number(s.balance).toFixed(0)}
                </p>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
