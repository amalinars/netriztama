export const DEFAULT_NINEROUTER_URL =
  (import.meta.env.VITE_NINEROUTER_URL as string) || 'https://9router.riztama.my.id/v1'

export const DEFAULT_NINEROUTER_KEY =
  (import.meta.env.VITE_NINEROUTER_KEY as string) || 'sk-6b3ac6ef8e3b70c9-eyxuxt-7adfd291'

export const DEFAULT_MODEL = 'ag/gemini-3-flash'

export interface ModelOption {
  id: string
  name: string
  description?: string
}

export const POPULAR_MODELS: ModelOption[] = [
  {
    id: 'ag/gemini-3-flash-agent',
    name: 'ag/gemini-3-flash-agent',
    description: 'Model Default yang diminta',
  },
  {
    id: 'ag/gemini-3-flash',
    name: 'ag/gemini-3-flash',
    description: 'Stabil & Cepat untuk Vision/Foto',
  },
  {
    id: 'ag/gemini-pro-agent',
    name: 'ag/gemini-pro-agent',
    description: 'Penalaran tinggi & akurat',
  },
  {
    id: 'gemini/gemini-2.5-flash',
    name: 'gemini/gemini-2.5-flash',
    description: 'Direct Gemini 2.5 Flash',
  },
  {
    id: 'gemini/gemini-3-flash-preview',
    name: 'gemini/gemini-3-flash-preview',
    description: 'Gemini 3 Flash Preview',
  },
]

export const DEFAULT_ORDER_ANALYSIS_PROMPT = `Analisis foto bukti order/transfer/transaksi ini secara teliti dan terstruktur.
Ekstrak poin-poin berikut (jika ada pada foto):

1. **Nama Pembeli / Akun Pengirim**:
2. **Kontak / WhatsApp** (jika tertera):
3. **Tanggal & Waktu Transaksi**:
4. **Nominal Pembayaran / Transfer**:
5. **Metode / Bank / E-Wallet Asal & Tujuan**:
6. **Produk / Paket Layanan** (cth: Netflix 1P / 2P, durasi hari/bulan):
7. **Nomor Referensi / ID Transaksi**:
8. **Status Bukti Transaksi** (cth: Berhasil / Lunas / Pending / Meragukan):
9. **Catatan Penting / Ringkasan**:

Sajikan dengan format rapi dan mudah dibaca.`

export interface AnalyzeOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
}

export interface AnalyzeResponse {
  content: string
  modelUsed: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  raw?: unknown
}

export async function analyzeImageWith9Router(
  imageDataUrl: string,
  prompt: string,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResponse> {
  let baseUrl = (options.baseUrl || DEFAULT_NINEROUTER_URL).replace(/\/+$/, '')
  const apiKey = options.apiKey || DEFAULT_NINEROUTER_KEY
  const model = options.model || DEFAULT_MODEL

  // Automatically use Vite/local proxy when accessing remote 9router in dev to avoid CORS preflight blocks
  if (
    typeof window !== 'undefined' &&
    baseUrl.includes('9router.riztama.my.id') &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || import.meta.env.DEV)
  ) {
    baseUrl = '/api-9router/v1'
  }

  const endpoint = `${baseUrl}/chat/completions`

  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt || 'Analisis foto ini dan jelaskan informasinya secara detail.',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
    stream: false,
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (fetchErr: unknown) {
    // If direct fetch failed (likely CORS preflight block), attempt fallback via proxy
    if (endpoint.startsWith('http') && !endpoint.includes('/api-9router/')) {
      try {
        const fallbackEndpoint = `/api-9router/v1/chat/completions`
        response = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        })
      } catch {
        throw new Error(
          `Gagal menghubungi 9Router (${(fetchErr as Error)?.message || 'Failed to fetch'}). Masalah ini biasanya terjadi karena CORS Preflight pada server 9router belum diizinkan.`
        )
      }
    } else {
      throw new Error(
        `Gagal menghubungi 9Router (${(fetchErr as Error)?.message || 'Failed to fetch'}). Masalah ini biasanya terjadi karena CORS Preflight pada server 9router belum diizinkan.`
      )
    }
  }

  if (!response.ok) {
    let errorDetails = `HTTP ${response.status} ${response.statusText}`
    try {
      const errJson = await response.json()
      if (errJson?.error) {
        errorDetails = typeof errJson.error === 'string' ? errJson.error : errJson.error.message || JSON.stringify(errJson.error)
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(`Gagal memanggil 9Router: ${errorDetails}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content || ''

  return {
    content,
    modelUsed: model,
    usage: data?.usage,
    raw: data,
  }
}
