import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const STATUS_HI = {
  in_laundry: 'Laundry mein',
  closed: 'Wapas aa gaya',
  disputed: 'Dispute mein',
}

/**
 * Shared laundry list page — used by both manager (English) and staff (Hinglish).
 */
export default function Laundry({ basePath = '/manager/laundry', hinglish = false }) {
  const { profile } = useAuth()

  const { data: open } = useQuery({
    queryKey: ['challans-open'],
    queryFn: async () => {
      const { data } = await supabase
        .from('challans')
        .select('*')
        .eq('status', 'in_laundry')
        .order('pickup_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: recent } = useQuery({
    queryKey: ['challans-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('challans')
        .select('*')
        .neq('status', 'in_laundry')
        .order('closed_at', { ascending: false, nullsFirst: false })
        .limit(20)
      return data ?? []
    },
  })

  const t = hinglish
    ? {
        title: 'Laundry',
        subtitle: 'Vendor ko diya / wapas liya — sab record yahan.',
        newBtn: 'Vendor ko dena',
        outAt: 'Vendor ke paas hai',
        recent: 'Wapas aa gaya',
        empty: 'Abhi vendor ke paas kuch nahi.',
        emptyRecent: 'Abhi koi history nahi.',
      }
    : {
        title: 'Laundry',
        subtitle: 'Dual-counted handoff record (out and back).',
        newBtn: 'Give to vendor',
        outAt: 'Out at vendor',
        recent: 'Returned (last 20)',
        empty: 'Nothing currently with a vendor.',
        emptyRecent: 'No history yet.',
      }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
          <p className="text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <Link to={`${basePath}/new`} className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          {t.newBtn}
        </Link>
      </div>

      <section>
        <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Clock className="h-4 w-4" /> {t.outAt} ({open?.length ?? 0})
        </h3>
        <div className="space-y-2">
          {open?.length === 0 && (
            <div className="card text-center text-sm text-slate-500">{t.empty}</div>
          )}
          {open?.map((c) => (
            <ChallanCard key={c.id} challan={c} basePath={basePath} hinglish={hinglish} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t.recent}
        </h3>
        <div className="space-y-2">
          {recent?.length === 0 && (
            <div className="card text-center text-sm text-slate-500">{t.emptyRecent}</div>
          )}
          {recent?.map((c) => (
            <ChallanCard key={c.id} challan={c} basePath={basePath} hinglish={hinglish} />
          ))}
        </div>
      </section>
    </div>
  )
}

function ChallanCard({ challan, basePath, hinglish }) {
  const totalItems = (challan.pickup_items ?? []).reduce((s, i) => s + (i.qty || 0), 0)
  const hasShortfall = challan.total_shortfall_qty > 0
  const hasDefects = challan.total_defect_qty > 0

  return (
    <Link
      to={`${basePath}/${challan.id}`}
      className={`card flex items-center justify-between transition active:bg-slate-50 ${
        hasShortfall || hasDefects ? 'border-l-4 border-l-amber-500' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-900">{challan.challan_number}</p>
          <span className="text-xs text-slate-400">{challan.property_id}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {challan.vendor_name} · {totalItems} item{totalItems === 1 ? '' : 's'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 ${
              challan.status === 'in_laundry'
                ? 'bg-blue-100 text-blue-800'
                : challan.status === 'closed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {hinglish ? STATUS_HI[challan.status] : challan.status.replace('_', ' ')}
          </span>
          {hasShortfall && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {challan.total_shortfall_qty} missing
            </span>
          )}
          {hasDefects && (
            <span className="text-amber-700">{challan.total_defect_qty} damaged</span>
          )}
          <span className="text-slate-400">
            {formatDistanceToNow(new Date(challan.pickup_at), { addSuffix: true })}
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
    </Link>
  )
}
