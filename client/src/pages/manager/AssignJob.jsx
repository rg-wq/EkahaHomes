import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Send } from 'lucide-react'

export default function AssignJob() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [propertyId, setPropertyId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [error, setError] = useState(null)

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => (await supabase.from('properties').select('id, name').order('name')).data,
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms', propertyId],
    enabled: !!propertyId,
    queryFn: async () =>
      (
        await supabase
          .from('rooms')
          .select('id, name, room_type')
          .eq('property_id', propertyId)
          .eq('active', true)
          .order('name')
      ).data,
  })

  const { data: templates } = useQuery({
    queryKey: ['templates-for-property', propertyId],
    enabled: !!propertyId,
    queryFn: async () =>
      (
        await supabase
          .from('templates')
          .select('id, name, room_type, tasks')
          .eq('property_id', propertyId)
          .eq('active', true)
          .order('name')
      ).data,
  })

  const { data: staffOptions } = useQuery({
    queryKey: ['staff-for-property', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, property_ids')
        .eq('role', 'staff')
        .eq('active', true)
      return (data ?? []).filter((s) => (s.property_ids ?? []).includes(propertyId))
    },
  })

  // When property changes, clear dependent fields
  useEffect(() => {
    setRoomId('')
    setTemplateId('')
    setStaffId('')
  }, [propertyId])

  const selectedTemplate = templates?.find((t) => t.id === templateId)
  const selectedRoom = rooms?.find((r) => r.id === roomId)

  const assignMutation = useMutation({
    mutationFn: async () => {
      const initialTasks = (selectedTemplate?.tasks ?? []).map((t) => ({
        ...t,
        done: false,
        photo_url: null,
        done_at: null,
      }))

      const payload = {
        property_id: propertyId,
        room_id: roomId || null,
        template_id: templateId,
        staff_id: staffId,
        booking_id: bookingId.trim() || null,
        tasks: initialTasks,
        status: 'assigned',
      }
      const { data, error } = await supabase.from('hk_jobs').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-qc'] })
      queryClient.invalidateQueries({ queryKey: ['hk-jobs'] })
      navigate('/manager')
    },
    onError: (e) => setError(e.message),
  })

  function validate() {
    if (!propertyId) return 'Pick a property.'
    if (!templateId) return 'Pick a template.'
    if (!staffId) return 'Pick a staff member.'
    return null
  }

  function onSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) return setError(err)
    setError(null)
    assignMutation.mutate()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/manager')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Assign housekeeping job</h2>
        <p className="text-sm text-slate-500">
          Pick property, room, template, and staff member. They'll see it on their phone.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Property</label>
            <select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">Select…</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Room <span className="text-slate-400">(optional)</span>
              </label>
              <select
                className="input"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={!propertyId}
              >
                <option value="">— Any —</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.room_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Template</label>
              <select
                className="input"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={!propertyId}
              >
                <option value="">Select…</option>
                {templates
                  ?.filter((t) => !selectedRoom || t.room_type === selectedRoom.room_type)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({(t.tasks ?? []).length} tasks)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Assign to</label>
            <select
              className="input"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              disabled={!propertyId}
            >
              <option value="">Select staff…</option>
              {staffOptions?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            {propertyId && staffOptions?.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No staff assigned to this property. Owner can update staff property access.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Booking reference <span className="text-slate-400">(optional)</span>
            </label>
            <input
              className="input"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="e.g. AIRBNB-123"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={assignMutation.isPending}>
            <Send className="h-4 w-4" />
            {assignMutation.isPending ? 'Assigning…' : 'Assign job'}
          </button>
        </form>
      </div>
    </div>
  )
}
