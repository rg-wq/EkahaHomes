import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Plus,
  Wallet,
  X,
} from 'lucide-react'
import { format } from 'date-fns'

export default function StaffLedgerDetail() {
  const { staffId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [showGive, setShowGive] = useState(false)

  const { data: staff } = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_ledger_view')
        .select('*')
        .eq('staff_id', staffId)
        .single()
      return data
    },
  })

  const { data: advances } = useQuery({
    queryKey: ['advances', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_advances')
        .select('*, given_by_profile:profiles!staff_advances_given_by_fkey(full_name)')
        .eq('staff_id', staffId)
        .order('given_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: expenses } = useQuery({
    queryKey: ['expenses-for-staff', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_expenses')
        .select('*')
        .eq('staff_id', staffId)
        .order('spent_at', { ascending: false })
        .limit(100)
      return data ?? []
    },
  })

  const timeline = [
    ...(advances ?? []).map((a) => ({ ...a, _type: 'advance', _date: a.given_at })),
    ...(expenses ?? []).map((e) => ({ ...e, _type: 'expense', _date: e.spent_at })),
  ].sort((a, b) => (a._date < b._date ? 1 : -1))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/manager/ledger')}
          className="inline-flex items-center gap-1 text-sm text-slate-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <header>
        <h2 className="text-lg font-semibold text-slate-900">{staff?.full_name}</h2>
        <p className="text-sm text-slate-500">Full ledger + give advance</p>
      </header>

      <div className="card bg-gradient-to-br from-brand-50 to-white">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-700">
          <Wallet className="h-4 w-4" /> Balance
        </div>
        <p className="mt-2 text-3xl font-bold text-slate-900">
          ₹{Number(staff?.balance ?? 0).toFixed(0)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-slate-500">Total given</p>
            <p className="font-semibold text-slate-900">
              ₹{Number(staff?.total_advances ?? 0).toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Approved spent</p>
            <p className="font-semibold text-slate-900">
              ₹{Number(staff?.total_approved_expenses ?? 0).toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Pending</p>
            <p className="font-semibold text-amber-700">
              ₹{Number(staff?.pending_amount ?? 0).toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      <button onClick={() => setShowGive(true)} className="btn-primary w-full">
        <Plus className="h-4 w-4" /> Give advance
      </button>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          History
        </h3>
        <div className="space-y-2">
          {timeline.length === 0 && (
            <div className="card text-center text-sm text-slate-500">No entries yet.</div>
          )}
          {timeline.map((row) => (
            <div key={`${row._type}-${row.id}`} className="card">
              {row._type === 'advance' ? (
                <div className="flex items-start gap-3">
                  <ArrowDownCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-slate-900">
                        Advance · {row.mode}
                      </p>
                      <p className="font-semibold text-green-700">
                        +₹{Number(row.amount).toFixed(0)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {format(new Date(row.given_at), 'd MMM yyyy')}
                      {row.given_by_profile?.full_name && ` · by ${row.given_by_profile.full_name}`}
                      {row.note ? ` · ${row.note}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{row.description}</p>
                      <p className="font-semibold text-slate-900">
                        -₹{Number(row.amount).toFixed(0)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {row.category} · {format(new Date(row.spent_at), 'd MMM yyyy')}
                      {row.property_id ? ` · ${row.property_id}` : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : row.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status}
                      </span>
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

      {showGive && (
        <GiveAdvanceModal
          staffId={staffId}
          onClose={() => setShowGive(false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] })
            queryClient.invalidateQueries({ queryKey: ['advances', staffId] })
            queryClient.invalidateQueries({ queryKey: ['all-staff-ledgers'] })
            setShowGive(false)
          }}
        />
      )}
    </div>
  )
}

function GiveAdvanceModal({ staffId, onClose, onDone }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  const submit = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount.')
      const { error } = await supabase.from('staff_advances').insert({
        staff_id: staffId,
        amount: amt,
        mode,
        note: note || null,
        given_by: user.id,
      })
      if (error) throw error
    },
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-900/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Give advance</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount (₹)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              className="input text-lg"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'upi', 'bank'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                    mode === m
                      ? 'border-brand-500 bg-brand-50 text-brand-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => submit.mutate()}
            className="btn-primary flex-1"
            disabled={submit.isPending}
          >
            {submit.isPending ? 'Saving…' : 'Confirm advance'}
          </button>
        </div>
      </div>
    </div>
  )
}
