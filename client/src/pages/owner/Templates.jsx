import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, FileEdit, Camera, AlertCircle } from 'lucide-react'

export default function Templates() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, property_id, room_type, tasks, version, active, updated_at')
        .eq('active', true)
        .order('property_id')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, name').order('name')
      return data ?? []
    },
  })

  const propertyName = (id) => properties?.find((p) => p.id === id)?.name ?? id

  // Group templates by property
  const grouped = (templates ?? []).reduce((acc, t) => {
    acc[t.property_id] = acc[t.property_id] || []
    acc[t.property_id].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Checklist templates</h2>
          <p className="text-sm text-slate-500">
            Used when assigning housekeeping jobs. Define once, reuse on every checkout.
          </p>
        </div>
        <Link to="/owner/templates/new" className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && templates?.length === 0 && (
        <div className="card text-center">
          <p className="text-slate-500">No templates yet.</p>
          <Link to="/owner/templates/new" className="btn-primary mt-3 inline-flex">
            Create first template
          </Link>
        </div>
      )}

      {Object.entries(grouped).map(([propertyId, items]) => (
        <section key={propertyId}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {propertyName(propertyId)}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TemplateCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function TemplateCard({ t }) {
  const taskCount = (t.tasks ?? []).length
  const photoCount = (t.tasks ?? []).filter((tk) => tk.photo_required).length
  const mandatoryCount = (t.tasks ?? []).filter((tk) => tk.mandatory).length

  return (
    <Link
      to={`/owner/templates/${t.id}`}
      className="card transition hover:shadow-md hover:ring-brand-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-slate-900">{t.name}</h4>
          <p className="text-xs text-slate-500 capitalize">{t.room_type}</p>
        </div>
        <FileEdit className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{taskCount} task{taskCount === 1 ? '' : 's'}</span>
        {photoCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3 w-3" /> {photoCount}
          </span>
        )}
        {mandatoryCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {mandatoryCount} required
          </span>
        )}
        <span className="ml-auto text-slate-400">v{t.version}</span>
      </div>
    </Link>
  )
}
