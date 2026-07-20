export type QueueTask<T> = () => Promise<T>

export type QueueProgress = {
  active: number
  pending: number
  completed: number
  total: number
}

/** Average per-file upload percents for a concurrent batch (0–100). */
export function blendedBatchPercent(perFile: number[], totalFiles: number) {
  if (!totalFiles) return 0
  const sum = perFile.reduce((acc, p) => acc + (p || 0), 0)
  return Math.min(100, Math.round(sum / totalFiles))
}

/**
 * Run async tasks with a concurrency limit (default 3).
 */
export async function runUploadQueue<T>(
  tasks: QueueTask<T>[],
  concurrency = 3,
  onProgress?: (progress: QueueProgress) => void,
): Promise<T[]> {
  if (!tasks.length) return []
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0
  let completed = 0
  let active = 0

  function report() {
    onProgress?.({
      active,
      pending: tasks.length - completed - active,
      completed,
      total: tasks.length,
    })
  }

  return new Promise((resolve, reject) => {
    let rejected = false

    function startNext() {
      if (rejected) return
      while (active < concurrency && nextIndex < tasks.length) {
        const idx = nextIndex++
        active++
        report()
        tasks[idx]()
          .then((value) => {
            results[idx] = value
            completed++
            active--
            report()
            if (completed === tasks.length) resolve(results)
            else startNext()
          })
          .catch((err) => {
            active--
            report()
            rejected = true
            reject(err)
          })
      }
    }

    startNext()
  })
}
