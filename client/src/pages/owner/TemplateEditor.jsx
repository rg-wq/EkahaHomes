import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Camera,
  Plus,
  Save,
  Trash2,
  AlertCircle,
} from 'lucide-react'

const ZONES = ['bedroom', 'bathroom', 'kitchen', 'common']

const NEW_TASK = () => ({
  task_id: crypto.randomUUID().slice(0, 8),
  name: '',
  instructions: '',
  zone: 'bedroom',
  mandatory: true,
  photo_required: false,
  sequence: 0,
  estimated_minutes: 5,
  linked_inventory_item: null,
})

export default function TemplateEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [roomType, setRoomType] = useState('suite')
  const [tasks, setTasks] = useState([])
  const [error, setError] = useState(null)

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, name').order('name')
      return data ?? []
    },
  })

  // Inventory items for the linked-item dropdown — refetch when property changes
  const { data: inventoryItems } = useQuery({
    queryKey: ['inventory-items', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('property_id', propertyId)
        .eq('active', true)
        .order('name')
      return data ?? []
    },
  })

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['template', id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setPropertyId(existing.property_id ?? '')
      setRoomType(existing.room_type)
      setTasks(
        (existing.tasks ?? []).map((t, i) => ({
          ...NEW_TASK(),
          ...t,
          sequence: t.sequence ?? i + 1,
        })),
      )
    }
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        property_id: propertyId,
        room_type: roomType.trim(),
        tasks: tasks.map((t, i) => ({ ...t, sequence: i + 1 })),
        created_by: user.id,
      }
      if (isNew) {
        const { data, error } = await supabase.from('templates').insert(payload).select().single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('templates')
          .update({ ...payload, version: (existing?.version ?? 1) + 1 })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      navigate('/owner/templates')
    },
    onError: (e) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('templates').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      navigate('/owner/templates')
    },
    onError: (e) => setError(e.message),
  })

  function updateTask(idx, patch) {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }
  function addTask() {
    setTasks((prev) => [...prev, { ...NEW_TASK(), sequence: prev.length + 1 }])
  }
  function removeTask(idx) {
    setTasks((prev) => prev.filter((_, i) => i !== idx))
  }
  function moveTask(idx, dir) {
    setTasks((prev) => {
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function validate() {
    if (!name.trim()) return 'Template name is required.'
    if (!propertyId) return 'Pick a property.'
    if (!roomType.trim()) return 'Room type is required.'
    if (tasks.length === 0) return 'Add at least one task.'
    for (const [i, t] of tasks.entries()) {
      if (!t.name.trim()) return `Task ${i + 1} needs a name.`
    }
    return null
  }

  function onSave() {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    saveMutation.mutate()
  }

  if (!isNew && loadingExisting) {
    return <p className="text-sm text-slate-400">Loading…</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/templates')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex gap-2">
          {!isNew && (
            <button
              onClick={() => {
                if (confirm('Archive this template? Existing jobs will keep their copy.')) {
                  deleteMutation.mutate()
                }
              }}
              className="btn-secondary text-sm text-red-600"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" /> Archive
            </button>
          )}
          <button onClick={onSave} className="btn-primary text-sm" disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          {isNew ? 'New template' : 'Edit template'}
        </h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Suite — Full Clean"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Property</label>
            <select
              className="input"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">Select a property…</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Room type</label>
            <input
              className="input"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              placeholder="e.g. suite, standard"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Tasks <span className="text-slate-400">({tasks.length})</span>
          </h3>
          <button onClick={addTask} className="btn-secondary text-sm">
            <Plus className="h-4 w-4" /> Add task
          </button>
        </div>

        {tasks.length === 0 && (
          <div className="card text-center text-sm text-slate-500">
            No tasks yet. Click <strong>Add task</strong> to start.
          </div>
        )}

        {tasks.map((t, idx) => (
          <div key={t.task_id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                #{idx + 1}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => moveTask(idx, -1)}
                  disabled={idx === 0}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => moveTask(idx, 1)}
                  disabled={idx === tasks.length - 1}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => removeTask(idx)}
                  className="rounded p-1 text-red-500 hover:bg-red-50"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Task name</label>
              <input
                className="input"
                value={t.name}
                onChange={(e) => updateTask(idx, { name: e.target.value })}
                placeholder="e.g. Strip & remake bed"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Instructions <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                className="input min-h-[60px]"
                value={t.instructions ?? ''}
                onChange={(e) => updateTask(idx, { instructions: e.target.value })}
                placeholder="What to do, what to watch for"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Zone</label>
                <select
                  className="input"
                  value={t.zone}
                  onChange={(e) => updateTask(idx, { zone: e.target.value })}
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Est. minutes
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  className="input"
                  value={t.estimated_minutes ?? 5}
                  onChange={(e) =>
                    updateTask(idx, { estimated_minutes: parseInt(e.target.value || 5, 10) })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Linked inventory item <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <select
                  className="input"
                  value={t.linked_inventory_item ?? ''}
                  onChange={(e) =>
                    updateTask(idx, { linked_inventory_item: e.target.value || null })
                  }
                  disabled={!propertyId}
                >
                  <option value="">— None —</option>
                  {inventoryItems?.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.mandatory}
                  onChange={(e) => updateTask(idx, { mandatory: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <AlertCircle className="h-4 w-4 text-slate-400" /> Required
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.photo_required}
                  onChange={(e) => updateTask(idx, { photo_required: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <Camera className="h-4 w-4 text-slate-400" /> Photo required
              </label>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={onSave} className="btn-primary" disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving…' : isNew ? 'Create template' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
