import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Receipt, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'

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

export default function OwnerExpenses() {
  const [monthOffset, setMonthOffset] = useState(0)
  const monthDate = useMemo(() => subMonths(new Date(), monthOffset), [monthOffset])
  const monthStart = useMemo(() => format(startOfMonth(monthDate), 'yyyy-MM-dd'), [monthDate])
  const monthEnd = useMemo(() => format(endOfMonth(monthDate), 'yyyy-MM-dd'), [monthDate])

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, name, location').order('name')
      return data ?? []
    },
  })

  const { data: summary } = useQuery({
    queryKey: ['expenses-monthly', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses_monthly_summary')
        .select('*')
        .eq('month', monthStart)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: recent } = useQuery({
    queryKey: ['expenses-recent', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses_with_meta')
        .select('*')
        .gte('spent_at', monthStart)
        .lte('spent_at', monthEnd)
        .order('spent_at', { ascending: false })
        .order('logged_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })

  // Group summary rows by property_id
  const byProperty = useMemo(() => {
    const map = new Map()
    for (const row of summary ?? []) {
      if (!map.has(row.property_id)) {
        map.set(row.property_id, { total: 0, categories: {} })
      }
      const entry = map.get(row.property_id)
      entry.total += Number(row.total)
      entry.categories[row.category] = (entry.categories[row.category] ?? 0) + Number(row.total)
    }
    return map
  }, [summary])

  const grandTotal = useMemo(
    () => (summary ?? []).reduce((s, r) => s + Number(r.total), 0),
    [summary],
  )

  const isCurrentMonth = monthOffset === 0
  const monthLabel = format(monthDate, 'MMMM yyyy')

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Expenses — P&L</h2>
        <p className="text-sm text-slate-500">Read-only. Manager logs entries.</p>
      </header>

      {/* Month switch */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setMonthOffset(monthOffset + 1)}
          className="btn-secondary !px-3 !py-1.5 text-sm"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <p className="text-base font-semibold text-slate-900">{monthLabel}</p>
        <button
          onClick={() => setMonthOffset(Math.max(0, monthOffset - 1))}
          disabled={isCurrentMonth}
          className="btn-secondary !px-3 !py-1.5 text-sm disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grand total */}
      <div className="card">
        <p className="text-xs uppercase tracking-wide text-slate-500">Total spend</p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">₹{grandTotal.toFixed(0)}</p>
        <p className="text-xs text-slate-400">across all properties · {monthLabel}</p>
      </div>

      {/* Per-property breakdown */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          By property
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {properties?.map((p) => {
            const data = byProperty.get(p.id)
            const total = data?.total ?? 0
            const cats = data?.categories ?? {}
            const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1])
            return (
              <div key={p.id} className="card">
                <h4 className="font-semibold text-slate-900">{p.name}</h4>
                <p className="text-xs text-slate-500">{p.location}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">₹{total.toFixed(0)}</p>
                {sortedCats.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No expenses logged</p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {sortedCats.map(([cat, amt]) => {
                      const pct = total > 0 ? (amt / total) * 100 : 0
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">{CATEGORY_LABELS[cat] ?? cat}</span>
                            <span className="font-medium text-slate-900">₹{amt.toFixed(0)}</span>
                          </div>
                          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-brand-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Recent entries */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent entries
        </h3>
        {recent?.length === 0 ? (
          <div className="card text-center text-sm text-slate-500">
            <Receipt className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            No entries in {monthLabel}.
          </div>
        ) : (
          <div className="space-y-1">
            {recent?.map((r) => (
              <div
                key={r.id}
                className="card flex items-start justify-between gap-3 !py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-slate-900">
                    <span className="font-medium">{CATEGORY_LABELS[r.category]}</span>{' '}
                    <span className="text-slate-500">— {r.description || '(no description)'}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {format(new Date(r.spent_at), 'd MMM')} · {r.property_name}
                    {r.source === 'staff_expense' && r.staff_expense_staff_name
                      ? ` · via ${r.staff_expense_staff_name}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.receipt_url && (
                    <a
                      href={r.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <p className="font-semibold text-slate-900">₹{Number(r.amount).toFixed(0)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
