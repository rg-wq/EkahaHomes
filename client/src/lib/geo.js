/**
 * Haversine distance between two lat/lng points, in meters.
 * Used to verify staff GPS check-in is within property geofence (spec: 100m radius).
 */
export function haversineMeters(a, b) {
  const R = 6_371_000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/**
 * Get current position via browser geolocation. Returns { lat, lng, accuracy }.
 * Rejects with a user-friendly Error message on denial/timeout.
 */
export function getCurrentPosition({ timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Your device does not support GPS.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable GPS in your browser settings to check in.'
            : err.code === err.TIMEOUT
              ? 'Could not get your location in time. Try again with a better signal.'
              : 'Could not get your location.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}
