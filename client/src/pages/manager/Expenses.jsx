import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Receipt, ExternalLink } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const CATEGORY_LABELS = {
  supplies: 'Supplies',
  travel: 'Travel',
  food: 'Food',
  maintenance: 'Maintenance',
  utilities: 'Utilities',
  laundry: 'Laundry',
  staff: 'Staff',
  other: 'Other',
}

const CATEGORY_COLORS = {
  supplies: 'bg-blue-50 text-blue-700',
  travel: 'bg-purple-50 text-purple-700',
  food: 'bg-amber-50 text-amber-700',
  maintenance: 'bg-orange-50 text-orange-700',
  utilities: 'bg-cyan-50 text-cyan-700',
  laundry: 'bg-indigo-50 text-indigo-700',
  staff: 'bg-pink-50 text-pink-700',
  other: 'bg-slate-100 text-slate-700',
}

function monthRange(monthDate) {
  return {
    from: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
    to: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
  }
}

export default function ManagerExpenses() {
  const queryClient = useQueryClient()
  const [monthOffset, setMonthOffset] = useState(0) // 0 = this month, 1 = last month
  const [propertyFilter, setPropertyFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const monthDate = useMemo(() => subMonths(new Date(), monthOffset), [monthOffset])
  const range = useMemo(() => monthRange(monthDate), [monthDate])

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, name').order('name')
      return data ?? []
    },
  })

  const { data: rows } = useQuery({
    queryKey: ['expenses-list', range.from, range.to, propertyFilter, categoryFilter],
    queryFn: async () => {
      let q = supabase
        .from('expenses_with_meta')
        .select('*')
        .gte('spent_at', range.from)
        .lte('spent_at', range.to)
        .order('spent_at', { ascending: false })
        .order('logged_at', { ascending: false })
      if (propertyFilter) q = q.eq('property_id', propertyFilter)
      if (categoryFilter) q = q.eq('category', categoryFilter)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const total = useMemo(
    () => (rows ?? []).reduce((s, r) => s + Number(r.amount), 0),
    [rows],
  )

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
    },
  })

  function onDelete(row) {
    if (row.source === 'staff_expense') {
      window.alert(
        'This entry came from an approved staff expense. To remove it, un-approve the source in Staff $.',
      )
      return
    }
    if (!window.confirm(`Delete ₹${Number(row.amount).toFixed(0)} ${CATEGORY_LABELS[row.category]} entry?`)) {
      return
    }
    deleteMutation.mutate(row.id)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Property Expenses</h2>
          <p className="text-sm text-slate-500">Direct logs + approved staff expenses</p>
        </div>
        <Link to="/manager/expenses/new" className="btn-primary !px-3 !py-2 text-sm">
          <Plus className="h-4 w-4" /> Log
        </Link>
      </header>

      {/* Month switch */}
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2].map((off) => (
          <button
            key={off}
            onClick={() => setMonthOffset(off)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              monthOffset === off
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {off === 0 ? 'This month' : format(subMonths(new Date(), off), 'MMM yyyy')}
          </button>
        ))}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {format(monthDate, 'MMM yyyy')} total
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">₹{total.toFixed(0)}</p>
          <p className="text-xs text-slate-400">{rows?.length ?? 0} entries</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Manual</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            ₹{(rows ?? []).filter(r => r.source === 'manual').reduce((s, r) => s + Number(r.amount), 0).toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">manager-logged</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">From staff</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            ₹{(rows ?? []).filter(r => r.source === 'staff_expense').reduce((s, r) => s + Number(r.amount), 0).toFixed(0)}
          </p>
          <p className="text-xs text-slate-400">approved expenses</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Property</label>
          <select
            className="input"
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
          >
            <option value="">All</option>
            {properties?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Category</label>
          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Entries
        </h3>
        {rows?.length === 0 ? (
          <div className="card text-center text-sm text-slate-500">
            <Receipt className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            No expenses in this period. Tap <strong>Log</strong> to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {rows?.map((r) => (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.other}`}>
                        {CATEGORY_LABELS[r.category]}
                      </span>
                      {r.source === 'staff_expense' && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          via {r.staff_expense_staff_name ?? 'staff'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-900">{r.description || '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {format(new Date(r.spent_at), 'd MMM')} · {r.property_name}
                      {r.logged_by_name ? ` · ${r.logged_by_name}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold text-slate-900">₹{Number(r.amount).toFixed(0)}</p>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      {r.receipt_url && (
                        <a
                          href={r.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-slate-700"
                          title="Receipt"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => onDelete(r)}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                        disabled={deleteMutation.isPending}
                        title={r.source === 'staff_expense' ? 'Un-approve in Staff $' : 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
