import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getCurrentPosition, haversineMeters } from '../../lib/geo'
import { MapPin, CheckCircle2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

export default function CheckIn() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [propertyId, setPropertyId] = useState('')
  const [status, setStatus] = useState(null) // { ok, message, distance }

  // Properties this staff is assigned to
  const { data: properties } = useQuery({
    queryKey: ['my-properties', profile?.property_ids],
    enabled: !!profile?.property_ids?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, name, lat, lng, geofence_meters')
        .in('id', profile.property_ids)
        .order('name')
      return data ?? []
    },
  })

  // Today's check-ins
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: todayLogs } = useQuery({
    queryKey: ['my-attendance-today', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_attendance')
        .select('id, property_id, checked_in_at, distance_m, within_geofence')
        .eq('staff_id', user.id)
        .gte('checked_in_at', todayStart.toISOString())
        .order('checked_in_at', { ascending: false })
      return data ?? []
    },
  })

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const prop = properties?.find((p) => p.id === propertyId)
      if (!prop) throw new Error('Property not found')

      const pos = await getCurrentPosition()
      const distance = haversineMeters({ lat: prop.lat, lng: prop.lng }, pos)
      const within = distance <= (prop.geofence_meters ?? 100)

      const { error } = await supabase.from('staff_attendance').insert({
        staff_id: user.id,
        property_id: propertyId,
        gps: { lat: pos.lat, lng: pos.lng, accuracy_m: pos.accuracy },
        distance_m: distance,
        within_geofence: within,
      })
      if (error) throw error
      return { within, distance: Math.round(distance) }
    },
    onSuccess: ({ within, distance }) => {
      setStatus(
        within
          ? { ok: true, message: 'Check-in ho gaya!', distance }
          : {
              ok: false,
              message: `Aap property se ${distance}m door hain. Manager ko bata diya.`,
              distance,
            },
      )
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] })
      setPropertyId('')
    },
    onError: (e) => {
      setStatus({ ok: false, message: e.message })
    },
  })

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">GPS Check-in</h2>
        <p className="text-sm text-slate-500">
          Property pe pahunch ke check-in karein. Location share karna zaroori hai.
        </p>
      </section>

      <div className="card space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Konsi property?
          </label>
          <select
            className="input"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">Select karein…</option>
            {properties?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-primary w-full"
          disabled={!propertyId || checkInMutation.isPending}
          onClick={() => checkInMutation.mutate()}
        >
          <MapPin className="h-4 w-4" />
          {checkInMutation.isPending ? 'Location le raha hai…' : 'Check-in karein'}
        </button>

        {status && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
              status.ok
                ? 'bg-green-50 text-green-800 ring-1 ring-green-200'
                : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
            }`}
          >
            {status.ok ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}
      </div>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Aaj ke check-ins
        </h3>
        <div className="mt-2 space-y-2">
          {todayLogs?.length === 0 && (
            <p className="card text-sm text-slate-500">Aaj abhi koi check-in nahi.</p>
          )}
          {todayLogs?.map((l) => (
            <div key={l.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{l.property_id}</p>
                <p className="text-xs text-slate-500">
                  {format(new Date(l.checked_in_at), 'h:mm a')}
                  {' · '}
                  {Math.round(l.distance_m ?? 0)}m
                </p>
              </div>
              {l.within_geofence ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
