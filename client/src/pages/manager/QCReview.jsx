import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  X,
  AlertTriangle,
  ThumbsUp,
  Send,
} from 'lucide-react'

export default function QCReview() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [flagged, setFlagged] = useState({}) // { task_id: note }
  const [generalNote, setGeneralNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const { data: job, isLoading } = useQuery({
    queryKey: ['qc-job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from('hk_jobs').select('*').eq('id', jobId).single()
      if (error) throw error
      return data
    },
  })

  const tasks = useMemo(
    () =>
      [...(job?.tasks ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [job],
  )
  const flaggedCount = Object.keys(flagged).length

  function toggleFlag(taskId) {
    setFlagged((prev) => {
      const next = { ...prev }
      if (taskId in next) delete next[taskId]
      else next[taskId] = ''
      return next
    })
  }

  function setFlagNote(taskId, note) {
    setFlagged((prev) => ({ ...prev, [taskId]: note }))
  }

  async function approve() {
    setError(null)
    setSubmitting(true)
    const { error } = await supabase
      .from('hk_jobs')
      .update({
        status: 'approved',
        qc_notes: generalNote || null,
        qc_by: user.id,
        qc_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    setSubmitting(false)
    if (error) return setError(error.message)
    queryClient.invalidateQueries({ queryKey: ['pending-qc'] })
    navigate('/manager/qc')
  }

  async function reject() {
    setError(null)
    if (flaggedCount === 0 && !generalNote.trim()) {
      setError('Flag at least one task or write a note explaining what to redo.')
      return
    }
    setSubmitting(true)

    // Mark flagged tasks as not-done + attach qc_note. Staff redoes only these.
    const updatedTasks = tasks.map((t) =>
      t.task_id in flagged
        ? { ...t, done: false, photo_url: null, qc_note: flagged[t.task_id] || generalNote, flagged: true }
        : { ...t, flagged: false, qc_note: null },
    )

    const { error } = await supabase
      .from('hk_jobs')
      .update({
        status: 'rejected',
        tasks: updatedTasks,
        qc_notes: generalNote || null,
        qc_by: user.id,
        qc_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    setSubmitting(false)
    if (error) return setError(error.message)
    queryClient.invalidateQueries({ queryKey: ['pending-qc'] })
    navigate('/manager/qc')
  }

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!job) return <p className="text-sm text-red-600">Job not found.</p>

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/manager/qc')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-xs text-slate-500">{job.property_id}</span>
      </div>

      {job.flagged_fast && (
        <div className="card border-l-4 border-l-amber-500 bg-amber-50 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Completed suspiciously fast
          </p>
          <p className="mt-1">
            Total time was below 60% of estimated. Review photos extra carefully.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-base font-semibold text-slate-900">Review tasks</h2>
        <p className="text-sm text-slate-500">
          Tap <strong>Flag</strong> on any task you want redone. Approve when satisfied.
        </p>
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskReviewCard
            key={t.task_id}
            task={t}
            isFlagged={t.task_id in flagged}
            flagNote={flagged[t.task_id] ?? ''}
            onToggleFlag={() => toggleFlag(t.task_id)}
            onFlagNote={(note) => setFlagNote(t.task_id, note)}
          />
        ))}
      </div>

      <div className="card">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          General note <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          className="input min-h-[60px]"
          value={generalNote}
          onChange={(e) => setGeneralNote(e.target.value)}
          placeholder="Goes to staff with this decision"
        />
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white px-4 py-3 sm:bottom-0">
        <div className="mx-auto flex max-w-5xl gap-2">
          <button
            onClick={reject}
            className="btn flex-1 bg-amber-600 text-white hover:bg-amber-700"
            disabled={submitting}
          >
            <Send className="h-4 w-4" />
            Send back ({flaggedCount})
          </button>
          <button
            onClick={approve}
            className="btn flex-1 bg-green-600 text-white hover:bg-green-700"
            disabled={submitting}
          >
            <ThumbsUp className="h-4 w-4" />
            Approve all
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskReviewCard({ task, isFlagged, flagNote, onToggleFlag, onFlagNote }) {
  return (
    <div
      className={`card ${
        isFlagged ? 'border-l-4 border-l-amber-500 bg-amber-50/30' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {task.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <X className="h-5 w-5 shrink-0 text-slate-300" />
            )}
            <p className="font-medium text-slate-900">{task.name}</p>
          </div>
          {task.instructions && (
            <p className="ml-7 mt-1 text-xs text-slate-500">{task.instructions}</p>
          )}
          <div className="ml-7 mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
            {task.zone && <span className="capitalize">{task.zone}</span>}
            {task.photo_required && (
              <span className="inline-flex items-center gap-1">
                <Camera className="h-3 w-3" /> required
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onToggleFlag}
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ring-1 ${
            isFlagged
              ? 'bg-amber-100 text-amber-800 ring-amber-300'
              : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          {isFlagged ? 'Flagged' : 'Flag'}
        </button>
      </div>

      {task.photo_url && (
        <a
          href={task.photo_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block overflow-hidden rounded-lg ring-1 ring-slate-200"
        >
          <img src={task.photo_url} alt={task.name} className="h-48 w-full object-cover" />
        </a>
      )}

      {isFlagged && (
        <input
          className="input mt-3 text-sm"
          placeholder="What needs redoing? (e.g. 'corners not clean')"
          value={flagNote}
          onChange={(e) => onFlagNote(e.target.value)}
        />
      )}
    </div>
  )
}
