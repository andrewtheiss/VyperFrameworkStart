// Shrinks + re-encodes an uploaded image until it fits under a byte budget.
//
// Strategy: try WebP first, then JPEG as fallback. For each format, step the
// longest-dimension down through a ladder, and at each size try a set of
// qualities. Return the first encoding that fits. This produces visually
// acceptable output in ~20–100ms for typical inputs.
//
// The returned width/height are the *encoded* pixel dimensions — the caller
// should pass those to the mint contract so viewers can reconstruct the
// original aspect ratio without re-decoding the bytes.

export type EncodedImage = {
  bytes: Uint8Array
  blob: Blob
  format: 'webp' | 'jpeg'
  mime: string
  width: number
  height: number
  quality: number
  sourceBytes: number
  durationMs: number
}

export class ImageTooLargeError extends Error {
  constructor(budget: number) {
    super(`could not compress image below ${budget} bytes — try a simpler image or raise the budget`)
    this.name = 'ImageTooLargeError'
  }
}

const DIM_STEPS = [1024, 768, 512, 384, 256, 192, 128] as const
const QUALITY_STEPS = [0.9, 0.75, 0.6, 0.45, 0.3] as const
const FORMAT_ORDER = [
  { format: 'webp' as const, mime: 'image/webp' },
  { format: 'jpeg' as const, mime: 'image/jpeg' },
]

export async function encodeToBudget(file: File, budget: number): Promise<EncodedImage> {
  const start = performance.now()
  const bitmap = await createImageBitmap(file)
  try {
    for (const { format, mime } of FORMAT_ORDER) {
      for (const maxDim of DIM_STEPS) {
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
        const w = Math.max(1, Math.round(bitmap.width * scale))
        const h = Math.max(1, Math.round(bitmap.height * scale))
        for (const quality of QUALITY_STEPS) {
          const blob = await renderAndEncode(bitmap, w, h, mime, quality)
          if (!blob) break
          // If the browser didn't honor the MIME (common for WebP on very old
          // Safari), fall through to the next format rather than store PNG.
          if (blob.type !== mime) break
          if (blob.size <= budget) {
            const bytes = new Uint8Array(await blob.arrayBuffer())
            return {
              bytes,
              blob,
              format,
              mime,
              width: w,
              height: h,
              quality,
              sourceBytes: file.size,
              durationMs: performance.now() - start,
            }
          }
        }
      }
    }
  } finally {
    bitmap.close()
  }
  throw new ImageTooLargeError(budget)
}

function renderAndEncode(
  bitmap: ImageBitmap,
  w: number,
  h: number,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality)
  })
}
