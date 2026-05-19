import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronRight } from 'lucide-react'

// Translate DB status enum → Hinglish for staff display
const STATUS_HI = {
  assigned: 'Naya kaam',
  in_progress: 'Chal raha hai',
  rejected: 'Dobara karna hai',
  submitted: 'Manager review',
  approved: 'OK ho gaya',
}

export default function StaffHome() {
  const { user, profile } = useAuth()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['my-jobs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hk_jobs')
        .select('id, property_id, room_id, status, assigned_at, started_at')
        .eq('staff_id', user.id)
        .in('status', ['assigned', 'in_progress', 'rejected'])
        .order('assigned_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          Namaste, {profile?.full_name?.split(' ')[0]}
        </h2>
        <p className="text-sm text-slate-500">Aaj ke kaam</p>
      </section>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-slate-400">Load ho raha hai…</p>}
        {jobs?.length === 0 && (
          <div className="card text-center">
            <p className="text-sm text-slate-500">Abhi koi kaam nahi hai.</p>
            <p className="mt-1 text-xs text-slate-400">
              Guest check-out hone par manager naya kaam dega.
            </p>
          </div>
        )}
        {jobs?.map((j) => (
          <Link
            key={j.id}
            to={`/staff/checklist/${j.id}`}
            className="card flex items-center justify-between transition active:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900">{j.property_id}</p>
              <p className="text-xs text-slate-500">{STATUS_HI[j.status] ?? j.status}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
