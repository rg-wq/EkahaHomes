import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PhotoCapture } from '../../components/PhotoCapture'
import { ArrowLeft, Send } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORIES = [
  { value: 'supplies', label: 'Saamaan', help: 'Cleaning, room items, etc.' },
  { value: 'travel', label: 'Travel', help: 'Auto, rickshaw, fuel' },
  { value: 'food', label: 'Khaana', help: 'Lunch, chai' },
  { value: 'other', label: 'Aur kuch', help: 'Koi bhi expense' },
]

export default function LogExpense() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('supplies')
  const [description, setDescription] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [spentAt, setSpentAt] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [error, setError] = useState(null)

  const { data: properties } = useQuery({
    queryKey: ['my-properties', profile?.property_ids],
    enabled: !!profile?.property_ids?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', profile.property_ids)
        .order('name')
      return data ?? []
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount)
      if (!amt || amt <= 0) throw new Error('Sahi amount likhein.')
      if (!description.trim()) throw new Error('Kya kharcha kiya, likhein.')

      const { error } = await supabase.from('staff_expenses').insert({
        staff_id: user.id,
        amount: amt,
        category,
        description: description.trim(),
        property_id: propertyId || null,
        spent_at: spentAt,
        receipt_url: receiptUrl,
        status: 'pending',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-ledger', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['my-expenses', user?.id] })
      navigate('/staff/ledger')
    },
    onError: (e) => setError(e.message),
  })

  return (
    <div className="space-y-4 pb-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Wapas
      </button>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Naya kharcha</h2>
        <p className="text-sm text-slate-500">
          Receipt ki photo lein. Manager approve karega, phir balance se kat jaayega.
        </p>
      </section>

      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Kitna paisa? (₹)</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            className="input text-lg"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Konsa kharcha?</label>
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Kya kharcha kiya?</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 4 toilet rolls, auto Ekaha 7"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tareekh</label>
            <input
              type="date"
              className="input"
              value={spentAt}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setSpentAt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Property</label>
            <select
              className="input"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">— Koi nahi —</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Receipt ki photo <span className="font-normal text-slate-400">(zaroori nahi but recommended)</span>
          </label>
          <PhotoCapture
            existingUrl={receiptUrl}
            folder="receipts"
            tags={['staff-expense']}
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
          <Send className="h-4 w-4" />
          {submit.isPending ? 'Bhej raha hai…' : 'Submit karein'}
        </button>
      </div>
    </div>
  )
}
