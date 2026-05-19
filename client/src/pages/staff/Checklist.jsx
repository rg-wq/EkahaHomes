import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PhotoCapture } from '../../components/PhotoCapture'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  AlertTriangle,
} from 'lucide-react'

const ZONE_HI = {
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  common: 'Common area',
}

export default function Checklist() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [openTaskId, setOpenTaskId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const { data: job, isLoading } = useQuery({
    queryKey: ['hk-job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from('hk_jobs').select('*').eq('id', jobId).single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (job) setTasks(job.tasks ?? [])
  }, [job])

  // Group tasks by zone, sorted by sequence
  const grouped = useMemo(() => {
    const g = {}
    ;[...tasks]
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .forEach((t) => {
        const z = t.zone || 'common'
        g[z] = g[z] || []
        g[z].push(t)
      })
    return g
  }, [tasks])

  const doneCount = tasks.filter((t) => t.done).length
  const total = tasks.length
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100)
  const allRequiredDone = tasks.every((t) => !t.mandatory || t.done)

  // Persist task state to server (debounced via simple "save on change")
  const saveTasksMutation = useMutation({
    mutationFn: async ({ newTasks, statusChange }) => {
      const updates = { tasks: newTasks }
      if (statusChange) Object.assign(updates, statusChange)
      const { data, error } = await supabase
        .from('hk_jobs')
        .update(updates)
        .eq('id', jobId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['hk-job', jobId], data)
    },
    onError: (e) => setError(e.message),
  })

  // Inventory ledger write — fire-and-forget when a task with linked item is ticked done
  async function maybeWriteInventoryLedger(task) {
    if (!task.linked_inventory_item || !job) return
    await supabase.from('inventory_ledger').insert({
      property_id: job.property_id,
      item_id: task.linked_inventory_item,
      event_type: 'staff_use',
      qty: -1,
      scope: 'room',
      related_id: job.id,
      related_type: 'hk_job',
      performed_by: user.id,
      note: `Used in: ${task.name}`,
    })
  }

  async function toggleDone(taskId) {
    const task = tasks.find((t) => t.task_id === taskId)
    if (!task) return

    // Photo gate
    if (task.photo_required && !task.photo_url && !task.done) {
      setOpenTaskId(taskId)
      return
    }

    const wasDone = task.done
    const newTasks = tasks.map((t) =>
      t.task_id === taskId
        ? { ...t, done: !t.done, done_at: t.done ? null : new Date().toISOString() }
        : t,
    )
    setTasks(newTasks)

    // First action also moves status to in_progress
    let statusChange = null
    if (job?.status === 'assigned') {
      statusChange = { status: 'in_progress', started_at: new Date().toISOString() }
    }

    await saveTasksMutation.mutateAsync({ newTasks, statusChange })

    // Write inventory ledger only when moving from undone → done (consumption event)
    if (!wasDone && task.linked_inventory_item) {
      await maybeWriteInventoryLedger(task)
    }
  }

  function onPhotoUploaded(taskId, { url }) {
    const newTasks = tasks.map((t) => (t.task_id === taskId ? { ...t, photo_url: url } : t))
    setTasks(newTasks)
    saveTasksMutation.mutate({ newTasks })
  }

  async function onSubmit() {
    setError(null)
    if (!allRequiredDone) {
      setError('Pehle saare zaroori kaam complete karein.')
      return
    }
    setSubmitting(true)

    // Suspiciously fast flag (spec rule #6)
    const totalEst = tasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0)
    const startedAt = job?.started_at ? new Date(job.started_at) : new Date()
    const actualMin = (Date.now() - startedAt.getTime()) / 60000
    const flaggedFast = totalEst > 0 && actualMin < totalEst * 0.6

    const { error } = await supabase
      .from('hk_jobs')
      .update({
        status: 'submitted',
        completed_at: new Date().toISOString(),
        tasks,
        flagged_fast: flaggedFast,
      })
      .eq('id', jobId)

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['my-jobs'] })
    queryClient.invalidateQueries({ queryKey: ['pending-qc'] })
    navigate('/staff')
  }

  if (isLoading) return <p className="text-sm text-slate-400">Load ho raha hai…</p>
  if (!job) return <p className="text-sm text-red-600">Kaam nahi mila.</p>

  const isRejected = job.status === 'rejected'
  const isSubmitted = job.status === 'submitted' || job.status === 'approved'

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/staff')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Wapas
        </button>
        <span className="text-xs text-slate-500">{job.property_id}</span>
      </div>

      {isRejected && job.qc_notes && (
        <div className="card border border-amber-300 bg-amber-50 text-sm text-amber-900">
          <p className="font-semibold">Manager ne dobara karne ko kaha:</p>
          <p className="mt-1">{job.qc_notes}</p>
        </div>
      )}

      {isSubmitted && (
        <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-900">
          Yeh kaam manager ke paas review ke liye gaya hai.
        </div>
      )}

      {/* Progress */}
      <div className="card">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-900">
            {doneCount} / {total} ho gaya
          </span>
          <span className="text-slate-500">{progress}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tasks grouped by zone */}
      {Object.entries(grouped).map(([zone, items]) => (
        <section key={zone}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {ZONE_HI[zone] ?? zone}
          </h3>
          <div className="space-y-2">
            {items.map((t) => (
              <TaskCard
                key={t.task_id}
                task={t}
                disabled={isSubmitted}
                isOpen={openTaskId === t.task_id}
                onToggle={() => toggleDone(t.task_id)}
                onOpen={() => setOpenTaskId(openTaskId === t.task_id ? null : t.task_id)}
                onPhotoUploaded={(payload) => onPhotoUploaded(t.task_id, payload)}
              />
            ))}
          </div>
        </section>
      ))}

      {error && (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {/* Sticky submit bar */}
      {!isSubmitted && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white px-4 py-3 sm:bottom-0">
          <div className="mx-auto max-w-5xl">
            <button
              onClick={onSubmit}
              className="btn-primary w-full"
              disabled={submitting || !allRequiredDone}
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Bhej raha hai…' : 'Submit for QC'}
            </button>
            {!allRequiredDone && (
              <p className="mt-1.5 text-center text-xs text-amber-700">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Saare zaroori kaam complete karein
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, disabled, isOpen, onToggle, onOpen, onPhotoUploaded }) {
  const needsPhoto = task.photo_required && !task.photo_url

  return (
    <div
      className={`card ${
        task.done ? 'bg-green-50/40 ring-green-200' : 'bg-white'
      } ${task.flagged ? 'border-l-4 border-l-amber-500' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          disabled={disabled}
          className="mt-0.5 shrink-0"
          aria-label={task.done ? 'Mark not done' : 'Mark done'}
        >
          {task.done ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <Circle className="h-6 w-6 text-slate-300" />
          )}
        </button>

        <button
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          disabled={disabled && !task.photo_url}
        >
          <p
            className={`font-medium ${
              task.done ? 'text-slate-500 line-through' : 'text-slate-900'
            }`}
          >
            {task.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {task.mandatory && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertCircle className="h-3 w-3" /> Zaroori
              </span>
            )}
            {task.photo_required && (
              <span className="inline-flex items-center gap-1">
                <Camera className="h-3 w-3" />
                {task.photo_url ? 'Photo ho gayi' : 'Photo chahiye'}
              </span>
            )}
            {task.estimated_minutes && <span>~{task.estimated_minutes} min</span>}
          </div>
        </button>
      </div>

      {(isOpen || needsPhoto) && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {task.instructions && (
            <p className="text-sm text-slate-600">{task.instructions}</p>
          )}
          {task.photo_required && (
            <PhotoCapture
              existingUrl={task.photo_url}
              required={!task.photo_url}
              folder="hk-jobs"
              tags={['hk-task', task.task_id]}
              onUploaded={onPhotoUploaded}
            />
          )}
          {task.qc_note && (
            <div className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Manager: {task.qc_note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
