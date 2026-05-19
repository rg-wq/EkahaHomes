export function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  )
}
