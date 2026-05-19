import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PhotoCapture } from '../components/PhotoCapture'
import { ArrowLeft, AlertTriangle, CheckCircle2, Camera, Send } from 'lucide-react'
import { format } from 'date-fns'

/**
 * View a single challan. If open, allow logging the return + closing.
 * If closed, read-only summary with photos.
 */
export default function LaundryDetail({ basePath = '/manager/laundry', hinglish = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [returnItems, setReturnItems] = useState([])
  const [returnNotes, setReturnNotes] = useState('')
  const [defectPhotos, setDefectPhotos] = useState([])
  const [error, setError] = useState(null)

  const { data: challan, isLoading } = useQuery({
    queryKey: ['challan', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('challans').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  // Initialize return form from pickup items
  useEffect(() => {
    if (!challan) return
    if (challan.status === 'in_laundry') {
      setReturnItems(
        (challan.pickup_items ?? []).map((it) => ({
          item_id: it.item_id,
          name: it.name,
          sent_qty: it.qty,
          returned_qty: it.qty, // default: assume all returned
          defect_qty: 0,
        })),
      )
    } else {
      setReturnItems(challan.return_items ?? [])
      setReturnNotes(challan.return_notes ?? '')
      setDefectPhotos(challan.defect_photos ?? [])
    }
  }, [challan])

  function updateReturnItem(idx, patch) {
    setReturnItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const close = useMutation({
    mutationFn: async () => {
      const enriched = returnItems.map((it) => {
        const sent = Number(it.sent_qty) || 0
        const returned = Math.max(0, Number(it.returned_qty) || 0)
        const defect = Math.max(0, Number(it.defect_qty) || 0)
        return {
          item_id: it.item_id,
          name: it.name,
          sent_qty: sent,
          returned_qty: returned,
          shortfall: Math.max(0, sent - returned),
          defect_qty: defect,
        }
      })

      const { error } = await supabase
        .from('challans')
        .update({
          return_items: enriched,
          return_notes: returnNotes.trim() || null,
          defect_photos: defectPhotos,
          return_staff_id: user.id,
          return_at: new Date().toISOString(),
          status: 'closed',
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challan', id] })
      queryClient.invalidateQueries({ queryKey: ['challans-open'] })
      queryClient.invalidateQueries({ queryKey: ['challans-recent'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (e) => setError(e.message),
  })

  const t = hinglish
    ? {
        back: 'Wapas',
        pickup: 'Pickup',
        return: 'Wapasi count',
        sent: 'Bheja',
        returned: 'Wapas aaya',
        defect: 'Kharab',
        notes: 'Note (optional)',
        defectPhotos: 'Kharab items ki photo',
        addPhoto: 'Photo add karein',
        closeBtn: 'Close challan',
        closing: 'Close ho raha hai…',
        closed: 'Challan band ho gaya',
        shortfall: 'Shortfall',
        defectTotal: 'Damaged',
        vendor: 'Vendor',
        property: 'Property',
      }
    : {
        back: 'Back',
        pickup: 'Pickup',
        return: 'Return count',
        sent: 'Sent',
        returned: 'Returned',
        defect: 'Damaged',
        notes: 'Notes (optional)',
        defectPhotos: 'Defect photos',
        addPhoto: 'Add photo',
        closeBtn: 'Close challan',
        closing: 'Closing…',
        closed: 'Challan closed',
        shortfall: 'Shortfall',
        defectTotal: 'Damaged',
        vendor: 'Vendor',
        property: 'Property',
      }

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!challan) return <p className="text-sm text-red-600">Challan not found.</p>

  const isOpen = challan.status === 'in_laundry'
  const computedShort = returnItems.reduce(
    (s, it) => s + Math.max(0, Number(it.sent_qty || 0) - Number(it.returned_qty || 0)),
    0,
  )
  const computedDefect = returnItems.reduce((s, it) => s + Number(it.defect_qty || 0), 0)

  return (
    <div className="space-y-4 pb-24">
      <button
        onClick={() => navigate(basePath)}
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </button>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{challan.challan_number}</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isOpen ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
            }`}
          >
            {isOpen ? (hinglish ? 'Laundry mein' : 'In laundry') : (hinglish ? 'Band' : 'Closed')}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
          <p>
            <span className="text-slate-400">{t.property}:</span> {challan.property_id}
          </p>
          <p>
            <span className="text-slate-400">{t.vendor}:</span> {challan.vendor_name}
          </p>
          <p>
            <span className="text-slate-400">{t.pickup}:</span>{' '}
            {format(new Date(challan.pickup_at), 'd MMM, h:mm a')}
          </p>
          {challan.return_at && (
            <p>
              <span className="text-slate-400">{t.return}:</span>{' '}
              {format(new Date(challan.return_at), 'd MMM, h:mm a')}
            </p>
          )}
          {!challan.vendor_acknowledged && isOpen && (
            <p className="col-span-2 mt-1 text-xs text-amber-700">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              Vendor did NOT verbally confirm pickup count.
            </p>
          )}
        </div>
      </section>

      {/* Pickup items list (read-only) */}
      <section className="card">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.pickup}</h3>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {(challan.pickup_items ?? []).map((it, idx) => (
              <tr key={idx} className="border-t border-slate-100 first:border-t-0">
                <td className="py-2 text-slate-700">{it.name}</td>
                <td className="py-2 text-right font-medium text-slate-900">{it.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Return section */}
      <section className="card">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.return}</h3>
        <div className="mt-2 space-y-2">
          {returnItems.map((it, idx) => {
            const sent = Number(it.sent_qty || 0)
            const ret = Number(it.returned_qty || 0)
            const short = Math.max(0, sent - ret)
            return (
              <div key={idx} className="rounded-lg ring-1 ring-slate-200 p-3">
                <div className="flex items-center justify-between text-sm font-medium text-slate-900">
                  <span>{it.name}</span>
                  {short > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> -{short}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-500">{t.sent}</label>
                    <input type="number" disabled className="input !py-1 text-sm bg-slate-50" value={sent} />
                  </div>
                  <div>
                    <label className="block text-slate-500">{t.returned}</label>
                    <input
                      type="number"
                      min={0}
                      max={sent}
                      className="input !py-1 text-sm"
                      value={ret}
                      onChange={(e) => updateReturnItem(idx, { returned_qty: e.target.value })}
                      disabled={!isOpen}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500">{t.defect}</label>
                    <input
                      type="number"
                      min={0}
                      max={ret}
                      className="input !py-1 text-sm"
                      value={it.defect_qty || 0}
                      onChange={(e) => updateReturnItem(idx, { defect_qty: e.target.value })}
                      disabled={!isOpen}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {(computedShort > 0 || computedDefect > 0) && isOpen && (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {computedShort > 0 && (
              <p>
                <strong>{computedShort}</strong> items missing → will be flagged in inventory ledger.
              </p>
            )}
            {computedDefect > 0 && (
              <p>
                <strong>{computedDefect}</strong> damaged → upload photos as proof below.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Defect photos */}
      {(isOpen || defectPhotos.length > 0) && (
        <section className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">
            {t.defectPhotos}
          </h3>
          <div className="space-y-2">
            {defectPhotos.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noreferrer" className="block">
                <img src={url} alt={`defect ${idx + 1}`} className="h-32 w-full object-cover rounded-md ring-1 ring-slate-200" />
              </a>
            ))}
            {isOpen && (
              <PhotoCapture
                folder="laundry-defects"
                tags={['laundry-defect', challan.challan_number]}
                onUploaded={({ url }) => setDefectPhotos((prev) => [...prev, url])}
                hinglish={hinglish}
              />
            )}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="card">
        <label className="mb-1 block text-sm font-medium text-slate-700">{t.notes}</label>
        {isOpen ? (
          <textarea
            className="input min-h-[60px]"
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
          />
        ) : (
          <p className="text-sm text-slate-600">{challan.return_notes ?? '—'}</p>
        )}
      </section>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {/* Sticky close button */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white px-4 py-3 sm:bottom-0">
          <div className="mx-auto max-w-5xl">
            <button
              onClick={() => close.mutate()}
              className="btn-primary w-full"
              disabled={close.isPending}
            >
              <Send className="h-4 w-4" />
              {close.isPending ? t.closing : t.closeBtn}
            </button>
            <p className="mt-1.5 text-center text-xs text-slate-500">
              {hinglish
                ? 'Wapasi ke baad close karein — inventory auto-update hogi.'
                : 'Closing triggers inventory updates (returns credited, shortfalls flagged).'}
            </p>
          </div>
        </div>
      )}

      {!isOpen && (
        <div className="card border border-green-200 bg-green-50 text-sm text-green-800 inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {t.closed}{challan.closed_at ? ` · ${format(new Date(challan.closed_at), 'd MMM')}` : ''}
        </div>
      )}
    </div>
  )
}
