import imageCompression from 'browser-image-compression'

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

if (!cloudName || !uploadPreset) {
  throw new Error(
    'Missing Cloudinary env vars. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.local.',
  )
}

/**
 * Compress an image and upload to Cloudinary. Returns the secure_url.
 * folder: organizes assets in Cloudinary (e.g. 'hk-jobs', 'receipts', 'guest-ids').
 */
export async function uploadImage(file, { folder = 'misc', tags = [] } = {}) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.82,
  })

  const formData = new FormData()
  formData.append('file', compressed)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', `stayops/${folder}`)
  if (tags.length) formData.append('tags', tags.join(','))

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cloudinary upload failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    bytes: data.bytes,
  }
}
