import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Plus, Trash2, Send, AlertTriangle } from 'lucide-react'

/**
 * Pickup form — staff or manager records items going out.
 * Creates challan with status='in_laundry'.
 */
export default function LaundryNew({ basePath = '/manager/laundry', hinglish = false }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  const [propertyId, setPropertyId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [vendorPhone, setVendorPhone] = useState('')
  const [vendorAcknowledged, setVendorAcknowledged] = useState(false)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  const { data: properties } = useQuery({
    queryKey: ['my-properties', profile?.property_ids],
    enabled: !!profile?.property_ids?.length,
    queryFn: async () =>
      (await supabase.from('properties').select('id, name').in('id', profile.property_ids).order('name')).data ?? [],
  })

  const { data: inventoryItems } = useQuery({
    queryKey: ['inventory-laundry', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('property_id', propertyId)
        .eq('tracking_model', 'count')
        .eq('active', true)
        .order('name')
      return data ?? []
    },
  })

  useEffect(() => {
    setItems([])
  }, [propertyId])

  function addItem() {
    setItems((prev) => [...prev, { item_id: '', name: '', qty: 1 }])
  }
  function updateItem(idx, patch) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it
        const merged = { ...it, ...patch }
        if (patch.item_id) {
          const found = inventoryItems?.find((x) => x.id === patch.item_id)
          if (found) merged.name = found.name
        }
        return merged
      }),
    )
  }
  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!propertyId) throw new Error(hinglish ? 'Property select karein.' : 'Pick a property.')
      if (!vendorName.trim()) throw new Error(hinglish ? 'Vendor ka naam likhein.' : 'Vendor name required.')
      if (items.length === 0) throw new Error(hinglish ? 'Kam se kam ek item add karein.' : 'Add at least one item.')
      for (const [i, it] of items.entries()) {
        if (!it.qty || it.qty <= 0)
          throw new Error(
            hinglish ? `Item ${i + 1} ki qty sahi nahi.` : `Item ${i + 1} qty invalid.`,
          )
        if (!it.name.trim() && !it.item_id)
          throw new Error(
            hinglish ? `Item ${i + 1} ka naam likhein.` : `Item ${i + 1} needs a name.`,
          )
      }

      const payload = {
        property_id: propertyId,
        vendor_name: vendorName.trim(),
        vendor_phone: vendorPhone.trim() || null,
        vendor_acknowledged: vendorAcknowledged,
        pickup_staff_id: user.id,
        pickup_notes: notes.trim() || null,
        pickup_items: items.map((it) => ({
          item_id: it.item_id || null,
          name: it.name,
          qty: Number(it.qty),
        })),
        status: 'in_laundry',
      }
      const { data, error } = await supabase.from('challans').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['challans-open'] })
      navigate(`${basePath}/${data.id}`)
    },
    onError: (e) => setError(e.message),
  })

  const t = hinglish
    ? {
        back: 'Wapas',
        title: 'Naya pickup',
        subtitle: 'Vendor ke saath count karein, phir save karein.',
        property: 'Konsi property?',
        vendor: 'Vendor ka naam',
        vendorPhone: 'Vendor phone (optional)',
        ack: 'Vendor ne count confirm kiya hai',
        items: 'Saaman',
        addItem: 'Item add karein',
        noItems: 'Abhi koi item nahi. Add karein.',
        itemPlaceholder: 'Item select karein…',
        otherName: 'Doosra naam (item not in list)',
        qty: 'Kitne?',
        notes: 'Note (optional)',
        save: 'Save pickup',
        saving: 'Save ho raha hai…',
      }
    : {
        back: 'Back',
        title: 'New pickup',
        subtitle: 'Count items with vendor, then save.',
        property: 'Property',
        vendor: 'Vendor name',
        vendorPhone: 'Vendor phone (optional)',
        ack: 'Vendor verbally confirmed the count',
        items: 'Items',
        addItem: 'Add item',
        noItems: 'No items added yet.',
        itemPlaceholder: 'Select item…',
        otherName: 'Name (if not in list)',
        qty: 'Qty',
        notes: 'Notes (optional)',
        save: 'Save pickup',
        saving: 'Saving…',
      }

  return (
    <div className="space-y-4 pb-6">
      <button
        onClick={() => navigate(basePath)}
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </button>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
        <p className="text-sm text-slate-500">{t.subtitle}</p>
      </section>

      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{t.property}</label>
          <select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">—</option>
            {properties?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.vendor}</label>
            <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Sai Laundry" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.vendorPhone}</label>
            <input className="input" inputMode="tel" value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="+91…" />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={vendorAcknowledged}
            onChange={(e) => setVendorAcknowledged(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          {t.ack}
        </label>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {t.items} <span className="text-slate-400">({items.length})</span>
          </h3>
          <button onClick={addItem} className="btn-secondary text-sm" disabled={!propertyId}>
            <Plus className="h-4 w-4" /> {t.addItem}
          </button>
        </div>

        {items.length === 0 && (
          <p className="mt-3 text-center text-sm text-slate-500">{t.noItems}</p>
        )}

        <div className="mt-3 space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="rounded-lg ring-1 ring-slate-200 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  #{idx + 1}
                </span>
                <button
                  onClick={() => removeItem(idx)}
                  className="ml-auto rounded p-1 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <select
                    className="input"
                    value={it.item_id}
                    onChange={(e) => updateItem(idx, { item_id: e.target.value })}
                  >
                    <option value="">{t.itemPlaceholder}</option>
                    {inventoryItems?.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                    <option value="">— Other —</option>
                  </select>
                  {!it.item_id && (
                    <input
                      className="input mt-2"
                      value={it.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      placeholder={t.otherName}
                    />
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="input"
                    value={it.qty}
                    onChange={(e) => updateItem(idx, { qty: e.target.value })}
                    placeholder={t.qty}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <label className="mb-1 block text-sm font-medium text-slate-700">{t.notes}</label>
        <textarea
          className="input min-h-[60px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {!vendorAcknowledged && (
        <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {hinglish
            ? 'Vendor ke confirm karne ke baad save karein. Issues bachega.'
            : "Best to save only after vendor verbally confirms. Avoids disputes."}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button onClick={() => save.mutate()} className="btn-primary w-full" disabled={save.isPending}>
        <Send className="h-4 w-4" />
        {save.isPending ? t.saving : t.save}
      </button>
    </div>
  )
}
