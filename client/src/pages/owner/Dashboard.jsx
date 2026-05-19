import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export default function OwnerDashboard() {
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('*').order('name')
      if (error) throw error
      return data
    },
  })

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Properties</h2>
        <p className="text-sm text-slate-500">Overview of all 3 Ekaha properties</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {properties?.map((p) => (
            <div key={p.id} className="card">
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <p className="text-sm text-slate-500">{p.location}</p>
              <p className="mt-3 text-xs text-slate-400">ID: {p.id}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Quick links</h2>
        <p className="text-sm text-slate-500">Module shells (build in progress)</p>
      </section>
    </div>
  )
}
