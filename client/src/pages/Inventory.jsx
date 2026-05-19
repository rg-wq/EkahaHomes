import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AlertTriangle, ArrowDownToLine, History, Plus, X } from 'lucide-react'

const MODEL_LABELS = {
  count: 'Count units',
  par: 'Par level',
  trigger: 'Replace trigger',
}
const MODEL_HELP = {
  count: 'Exact number. Auto-deducted when staff completes a linked task.',
  par: 'Top-up only — not counted in units. Staff confirms refilled.',
  trigger: 'Auto-prompts replacement after N refills.',
}

export default function Inventory() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [propertyId, setPropertyId] = useState('')
  const [actionItem, setActionItem] = useState(null) // { item, mode: 'topup' | 'receive' }

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => (await supabase.from('properties').select('id, name').order('name')).data,
  })

  // Default to first accessible property
  if (!propertyId && properties?.length) {
    const accessible = properties.find((p) => profile?.property_ids?.includes(p.id)) || properties[0]
    setPropertyId(accessible.id)
  }

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('property_id', propertyId)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })

  const grouped = useMemo(() => {
    const g = { count: [], par: [], trigger: [] }
    ;(items ?? []).forEach((i) => g[i.tracking_model]?.push(i))
    return g
  }, [items])

  const reorderAlerts = useMemo(
    () => (items ?? []).filter((i) => i.tracking_model === 'count' && i.cupboard_qty <= i.reorder_threshold),
    [items],
  )

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Inventory</h2>
        <p className="text-sm text-slate-500">
          Per-property stock. Staff actions in checklist auto-deduct room qty.
        </p>
      </header>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Property</label>
        <select
          className="input max-w-xs"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          {properties?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {reorderAlerts.length > 0 && (
        <section>
          <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Needs reorder ({reorderAlerts.length})
          </h3>
          <div className="space-y-2">
            {reorderAlerts.map((i) => (
              <ItemRow key={i.id} item={i} onAction={setActionItem} alert />
            ))}
          </div>
        </section>
      )}

      {['count', 'par', 'trigger'].map((model) =>
        grouped[model].length > 0 ? (
          <section key={model}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {MODEL_LABELS[model]}
            </h3>
            <p className="mb-2 text-xs text-slate-400">{MODEL_HELP[model]}</p>
            <div className="space-y-2">
              {grouped[model].map((i) => (
                <ItemRow key={i.id} item={i} onAction={setActionItem} />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {actionItem && (
        <ActionModal
          item={actionItem.item}
          mode={actionItem.mode}
          onClose={() => setActionItem(null)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['inventory', propertyId] })
            setActionItem(null)
          }}
        />
      )}
    </div>
  )
}

function ItemRow({ item, onAction, alert }) {
  const isCount = item.tracking_model === 'count'
  const isPar = item.tracking_model === 'par'

  return (
    <div className={`card ${alert ? 'border-l-4 border-l-amber-500' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{item.name}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
            {isCount && (
              <>
                <span>Cupboard: <strong className="text-slate-900">{item.cupboard_qty}</strong></span>
                <span>Room: <strong className="text-slate-900">{item.room_qty}</strong></span>
                <span className="text-slate-400">Threshold: {item.reorder_threshold}</span>
              </>
            )}
            {isPar && <span className="text-slate-400">Topped up as needed</span>}
            {item.tracking_model === 'trigger' && (
              <span>Refill count: <strong className="text-slate-900">{item.refill_count}</strong> / {item.replace_after_n ?? '—'}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {isCount && (
            <>
              <button
                onClick={() => onAction({ item, mode: 'topup' })}
                className="btn-secondary !px-2 !py-1 text-xs"
                title="Move from cupboard to room"
                disabled={item.cupboard_qty === 0}
              >
                <ArrowDownToLine className="h-3 w-3" /> Top up
              </button>
              <button
                onClick={() => onAction({ item, mode: 'receive' })}
                className="btn-secondary !px-2 !py-1 text-xs"
                title="Receive new stock from supplier"
              >
                <Plus className="h-3 w-3" /> Receive
              </button>
            </>
          )}
          {isPar && (
            <button
              onClick={() => onAction({ item, mode: 'par_refill' })}
              className="btn-secondary !px-2 !py-1 text-xs"
            >
              Refilled
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionModal({ item, mode, onClose, onDone }) {
  const { user } = useAuth()
  const [qty, setQty] = useState(mode === 'par_refill' ? 1 : Math.min(4, item.cupboard_qty || 1))
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  const titles = {
    topup: `Top up room — ${item.name}`,
    receive: `Receive new stock — ${item.name}`,
    par_refill: `Mark refilled — ${item.name}`,
  }
  const helps = {
    topup: `Move stock from cupboard → room. You have ${item.cupboard_qty} in cupboard.`,
    receive: 'New stock arriving from supplier → adds to cupboard.',
    par_refill: 'Logs that you topped this item up. No quantity tracking for par items.',
  }

  const submit = useMutation({
    mutationFn: async () => {
      const q = Number(qty)
      if (mode === 'topup') {
        if (q < 1 || q > item.cupboard_qty) throw new Error('Quantity out of range.')
        // 2 ledger rows in a transaction-ish sequence
        const events = [
          {
            property_id: item.property_id,
            item_id: item.id,
            event_type: 'topup_room',
            qty: -q,
            scope: 'cupboard',
            performed_by: user.id,
            note: note || null,
          },
          {
            property_id: item.property_id,
            item_id: item.id,
            event_type: 'topup_room',
            qty: q,
            scope: 'room',
            performed_by: user.id,
            note: note || null,
          },
        ]
        const { error } = await supabase.from('inventory_ledger').insert(events)
        if (error) throw error
      } else if (mode === 'receive') {
        if (q < 1) throw new Error('Quantity must be positive.')
        const { error } = await supabase.from('inventory_ledger').insert({
          property_id: item.property_id,
          item_id: item.id,
          event_type: 'new_stock',
          qty: q,
          scope: 'cupboard',
          performed_by: user.id,
          note: note || null,
        })
        if (error) throw error
      } else if (mode === 'par_refill') {
        const { error } = await supabase.from('inventory_ledger').insert({
          property_id: item.property_id,
          item_id: item.id,
          event_type: 'par_refill',
          qty: 0,
          scope: 'room',
          performed_by: user.id,
          note: note || null,
        })
        if (error) throw error
      }
    },
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-900/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{titles[mode]}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">{helps[mode]}</p>

        {mode !== 'par_refill' && (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
            <input
              type="number"
              min={1}
              max={mode === 'topup' ? item.cupboard_qty : 9999}
              className="input"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Note <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => submit.mutate()}
            className="btn-primary flex-1"
            disabled={submit.isPending}
          >
            {submit.isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
