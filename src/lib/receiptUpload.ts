/**
 * Upload bukti transfer ke Cloudinary supaya tersimpan permanen & historis.
 *
 * Kenapa tidak disimpan sebagai base64 di database?
 * - base64 menambah ~33% ukuran dan membengkakkan row/payload.
 * - Cloudinary sudah dipakai untuk foto testimoni (unsigned preset yang sama),
 *   jadi tidak perlu backend baru.
 *
 * Yang disimpan ke DB cuma URL-nya (netflix.orders.receipt_url / receipt_urls).
 */

const CLOUDINARY_FOLDER = 'netriztama/receipts'

type CloudinaryUploadResponse = {
  secure_url?: string
  public_id?: string
  error?: { message?: string }
}

function cloudinaryConfig() {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) return null
  return { cloudName, uploadPreset }
}

/** True kalau Vite env Cloudinary terisi (dipakai untuk pesan error yang jelas). */
export function isReceiptStorageConfigured() {
  return cloudinaryConfig() !== null
}

/**
 * Konversi dataURL (hasil FileReader di Checkout) jadi Blob
 * supaya bisa dikirim sebagai multipart, bukan base64 mentah.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg'
  const binary = atob(encoded ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function extensionFor(mime: string) {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

/**
 * Upload satu gambar bukti transfer, balikin secure_url.
 * Melempar Error dengan pesan yang enak dibaca kalau gagal.
 */
export async function uploadReceiptImage(image: string | Blob): Promise<string> {
  const config = cloudinaryConfig()
  if (!config) {
    throw new Error('Penyimpanan bukti transfer (Cloudinary) belum dikonfigurasi')
  }

  let blob: Blob
  let filename = 'bukti-transfer.jpg'

  if (typeof image === 'string') {
    if (!image.startsWith('data:')) return image // sudah berupa URL, tidak perlu upload ulang
    blob = dataUrlToBlob(image)
    filename = `bukti-transfer.${extensionFor(blob.type)}`
  } else {
    blob = image
    filename = image instanceof File && image.name ? image.name : `bukti-transfer.${extensionFor(image.type)}`
  }

  const body = new FormData()
  body.append('file', blob, filename)
  body.append('upload_preset', config.uploadPreset)
  body.append('folder', CLOUDINARY_FOLDER)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    { method: 'POST', body }
  )
  const data = (await response.json().catch(() => ({}))) as CloudinaryUploadResponse

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Upload bukti transfer gagal (HTTP ${response.status})`)
  }
  if (!data.secure_url) {
    throw new Error('Cloudinary tidak mengembalikan URL bukti transfer')
  }
  return data.secure_url
}

/** Tambah URL bukti baru ke daftar yang sudah ada, tanpa duplikat. */
export function appendReceiptUrl(existing: string[] | null | undefined, next: string): string[] {
  const list = Array.isArray(existing) ? [...existing] : []
  if (next && !list.includes(next)) list.push(next)
  return list
}
