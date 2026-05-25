import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PhotoCapture } from '../../components/PhotoCapture'
import { ArrowLeft, Save } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORIES = [
  { value: 'supplies',    label: 'Supplies',    help: 'Toiletries, linens, kitchen' },
  { value: 'maintenance', label: 'Maintenance', help: 'Repairs, electrician, plumber' },
  { value: 'utilities',   label: 'Utilities',   help: 'Electricity, water, internet, gas' },
  { value: 'laundry',     label: 'Laundry',     help: 'Vendor bill, dry-clean' },
  { value: 'staff',       label: 'Staff',       help: 'Wages, bonuses (not advances)' },
  { value: 'travel',      label: 'Travel',      help: 'Auto, fuel, parking' },
  { value: 'food',        label: 'Food',        help: 'Welcome basket, guest meal' },
  { value: 'other',       label: 'Other',       help: 'Anything else' },
]

export default function ExpenseNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('supplies')
  const [propertyId, setPropertyId] = useState('')
  const [description, setDescription] = useState('')
  const [spentAt, setSpentAt] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [bookingId, setBookingId] = useState('')
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [error, setError] = useState(null)

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, name').order('name')
      return data ?? []
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount.')
      if (!propertyId) throw new Error('Pick a property.')
      if (!description.trim()) throw new Error('Add a short description.')

      const { error } = await supabase.from('expenses').insert({
        property_id: propertyId,
        amount: amt,
        category,
        description: description.trim(),
        receipt_url: receiptUrl,
        spent_at: spentAt,
        booking_id: bookingId.trim() || null,
        logged_by: user.id,
        source: 'manual',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
      queryClient.invalidateQueries({ queryKey: ['expenses-monthly'] })
      navigate('/manager/expenses')
    },
    onError: (e) => setError(e.message),
  })

  return (
    <div className="space-y-4 pb-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Log property expense</h2>
        <p className="text-sm text-slate-500">
          Direct entry — vendor bill, utility, repair. Goes straight to P&L.
        </p>
      </section>

      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Amount (₹)</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            className="input text-lg"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Property</label>
          <select
            className="input"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">— Select —</option>
            {properties?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  category === c.value
                    ? 'border-brand-500 bg-brand-50 text-brand-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-slate-500">{c.help}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Plumber visit — bathroom leak"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              className="input"
              value={spentAt}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setSpentAt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Booking ref <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              className="input"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="e.g. HMABC123"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Receipt <span className="font-normal text-slate-400">(recommended)</span>
          </label>
          <PhotoCapture
            existingUrl={receiptUrl}
            folder="expenses"
            tags={['manager-expense']}
            hinglish={false}
            onUploaded={({ url }) => setReceiptUrl(url)}
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={() => submit.mutate()}
          className="btn-primary w-full"
          disabled={submit.isPending}
        >
          <Save className="h-4 w-4" />
          {submit.isPending ? 'Saving…' : 'Save expense'}
        </button>
      </div>
    </div>
  )
}
