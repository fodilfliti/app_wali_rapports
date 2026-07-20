/// <reference lib="webworker" />

type CompressRequest = {
  id: number
  buffer: ArrayBuffer
  mime: string
  maxBytes: number
  maxDim: number
  preferWebp: boolean
}

type CompressResponse = {
  id: number
  ok: true
  buffer: ArrayBuffer
  mime: string
  ext: string
} | {
  id: number
  ok: false
  error: string
}

function canvasToBlob(canvas: OffscreenCanvas, type: string, quality?: number): Promise<Blob | null> {
  return canvas.convertToBlob({ type, quality })
}

async function compressInWorker(req: CompressRequest): Promise<CompressResponse> {
  try {
    const blob = new Blob([req.buffer], { type: req.mime })
    const bitmap = await createImageBitmap(blob)
    let width = bitmap.width
    let height = bitmap.height
    const maxDim = req.maxDim
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { id: req.id, ok: false, error: 'mediaImageReadFailed' }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const attempts: { type: string; ext: string; qualities: (number | undefined)[] }[] =
      req.preferWebp
        ? [
            { type: 'image/webp', ext: '.webp', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] },
            { type: 'image/jpeg', ext: '.jpg', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] },
          ]
        : req.mime === 'image/png'
          ? [
              { type: 'image/png', ext: '.png', qualities: [undefined] },
              { type: 'image/jpeg', ext: '.jpg', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] },
            ]
          : [{ type: 'image/jpeg', ext: '.jpg', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] }]

    for (const attempt of attempts) {
      for (const quality of attempt.qualities) {
        const out = await canvasToBlob(canvas, attempt.type, quality)
        if (!out) continue
        if (out.size <= req.maxBytes) {
          return {
            id: req.id,
            ok: true,
            buffer: await out.arrayBuffer(),
            mime: attempt.type,
            ext: attempt.ext,
          }
        }
      }
    }
    return { id: req.id, ok: false, error: 'mediaFileTooLarge' }
  } catch {
    return { id: req.id, ok: false, error: 'mediaImageReadFailed' }
  }
}

self.onmessage = (ev: MessageEvent<CompressRequest>) => {
  compressInWorker(ev.data).then((res) => self.postMessage(res, res.ok ? [res.buffer] : []))
}

export {}
