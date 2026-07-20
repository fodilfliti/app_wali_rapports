import { ENABLE_CLIENT_VIDEO_TRANSCODE } from '../config/features'
import { MEDIA_MAX_VIDEO_BYTES, MediaUploadError, formatBytes } from './media'

let ffmpegModule: typeof import('@ffmpeg/ffmpeg') | null = null
let ffmpegUtil: typeof import('@ffmpeg/util') | null = null
let ffmpegInstance: import('@ffmpeg/ffmpeg').FFmpeg | null = null
let loadPromise: Promise<void> | null = null

async function ensureFfmpeg() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    ffmpegModule = await import('@ffmpeg/ffmpeg')
    ffmpegUtil = await import('@ffmpeg/util')
    ffmpegInstance = new ffmpegModule.FFmpeg()
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpegInstance.load({
      coreURL: await ffmpegUtil!.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await ffmpegUtil!.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
  })()
  return loadPromise
}

export type VideoPrepProgress = {
  phase: 'loading' | 'transcoding'
  percent: number
}

/**
 * Optional client-side video re-encode (H.264 MP4, max 720p) when feature flag is on.
 * Falls back to original file on failure or when flag is off.
 */
export async function prepareVideoForUpload(
  file: File,
  onProgress?: (p: VideoPrepProgress) => void,
): Promise<File> {
  if (!ENABLE_CLIENT_VIDEO_TRANSCODE) {
    if (file.size > MEDIA_MAX_VIDEO_BYTES) {
      throw new MediaUploadError('mediaFileTooLarge', { max: formatBytes(MEDIA_MAX_VIDEO_BYTES) })
    }
    return file
  }
  if (!file.type.startsWith('video/')) return file
  if (file.size <= MEDIA_MAX_VIDEO_BYTES && file.size < 15 * 1024 * 1024) return file

  try {
    onProgress?.({ phase: 'loading', percent: 0 })
    await ensureFfmpeg()
    const ffmpeg = ffmpegInstance!
    const { fetchFile } = ffmpegUtil!

    onProgress?.({ phase: 'transcoding', percent: 5 })
    const inputName = `input.${file.name.split('.').pop() || 'mp4'}`
    const outputName = 'output.mp4'
    await ffmpeg.writeFile(inputName, await fetchFile(file))

    ffmpeg.on('progress', ({ progress }) => {
      onProgress?.({ phase: 'transcoding', percent: Math.min(95, Math.round((progress || 0) * 100)) })
    })

    await ffmpeg.exec([
      '-i',
      inputName,
      '-vf',
      'scale=min(1280\\,iw):min(720\\,ih):force_original_aspect_ratio=decrease',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '28',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputName,
    ])

    const data = await ffmpeg.readFile(outputName)
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)

    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    const blob = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' })
    if (blob.size > MEDIA_MAX_VIDEO_BYTES) {
      throw new MediaUploadError('mediaFileTooLarge', { max: formatBytes(MEDIA_MAX_VIDEO_BYTES) })
    }
    onProgress?.({ phase: 'transcoding', percent: 100 })
    const base = file.name.replace(/\.[^.]+$/, '') || 'video'
    return new File([blob], `${base}.mp4`, { type: 'video/mp4' })
  } catch (err) {
    if (err instanceof MediaUploadError) throw err
    if (file.size > MEDIA_MAX_VIDEO_BYTES) {
      throw new MediaUploadError('mediaFileTooLarge', { max: formatBytes(MEDIA_MAX_VIDEO_BYTES) })
    }
    return file
  }
}
