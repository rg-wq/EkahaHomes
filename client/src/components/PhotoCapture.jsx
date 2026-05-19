import { useRef, useState } from 'react'
import { Camera, RefreshCw, X } from 'lucide-react'
import { uploadImage } from '../lib/cloudinary'

/**
 * Photo capture button + preview. Uses camera on mobile, file picker on desktop.
 * Calls onUploaded({ url, publicId }) when upload succeeds.
 *
 * Labels in Hinglish for the staff flow.
 */
export function PhotoCapture({
  existingUrl,
  onUploaded,
  folder = 'hk-jobs',
  tags = [],
  required = false,
  hinglish = true,
}) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const t = hinglish
    ? {
        take: 'Photo lein',
        retake: 'Phir se',
        uploading: 'Bhej raha hai…',
        failed: 'Upload fail hua. Phir se try karein.',
        required: 'Photo zaroori hai',
      }
    : {
        take: 'Take photo',
        retake: 'Retake',
        uploading: 'Uploading…',
        failed: 'Upload failed. Try again.',
        required: 'Photo required',
      }

  async function onChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const { url, publicId } = await uploadImage(file, { folder, tags })
      onUploaded({ url, publicId })
    } catch (err) {
      console.error(err)
      setError(t.failed)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />

      {existingUrl ? (
        <div className="relative">
          <img
            src={existingUrl}
            alt="Uploaded"
            className="h-40 w-full rounded-lg object-cover ring-1 ring-slate-200"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-700 shadow ring-1 ring-slate-200"
            disabled={uploading}
          >
            <RefreshCw className="h-3 w-3" />
            {uploading ? t.uploading : t.retake}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition ${
            required
              ? 'border-amber-400 bg-amber-50 text-amber-700'
              : 'border-slate-300 bg-slate-50 text-slate-500'
          } active:bg-slate-100`}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
              <span className="text-sm">{t.uploading}</span>
            </>
          ) : (
            <>
              <Camera className="h-8 w-8" />
              <span className="text-sm font-medium">{t.take}</span>
              {required && <span className="text-xs">{t.required}</span>}
            </>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
          <X className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  )
}
