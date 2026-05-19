import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AlertTriangle, Camera, ChevronRight, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function QC() {
  const { data, isLoading } = useQuery({
    queryKey: ['pending-qc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_qc_jobs_view')
        .select('*')
      if (error) throw error
      return data
    },
  })

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">QC review queue</h2>
        <p className="text-sm text-slate-500">
          Submitted jobs waiting for your approval. Flagged-fast jobs are highlighted.
        </p>
      </section>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {data?.length === 0 && (
        <div className="card text-center text-sm text-slate-500">
          All caught up — nothing pending.
        </div>
      )}

      <div className="space-y-2">
        {data?.map((j) => (
          <Link
            key={j.id}
            to={`/manager/qc/${j.id}`}
            className={`card flex items-center justify-between transition active:bg-slate-50 ${
              j.flagged_fast ? 'border-l-4 border-l-amber-500' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">{j.property_name}</p>
                {j.flagged_fast && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    <AlertTriangle className="h-3 w-3" /> Fast
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {j.room_name ? `${j.room_name} · ` : ''}
                {j.staff_name ?? 'Unassigned'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {j.completed_at && formatDistanceToNow(new Date(j.completed_at), { addSuffix: true })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  {j.photo_count}/{j.task_count}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
