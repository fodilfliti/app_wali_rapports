import type { UploadPhase } from '../utils/uploadFile'

type Props = {
  percent: number
  label?: string
  /** Default `uploading`. `scanning` = indeterminate pulse (no fake %). */
  phase?: UploadPhase
}

export function UploadProgressBar({ percent, label, phase = 'uploading' }: Props) {
  const scanning = phase === 'scanning'
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div
      className={`uploadProgress${scanning ? ' isScanning' : ''}`}
      role="progressbar"
      aria-busy={scanning || undefined}
      aria-valuenow={scanning ? undefined : clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={label || undefined}
    >
      {label ? <span className="muted small uploadProgressLabel">{label}</span> : null}
      <div className="uploadProgressTrack">
        {scanning ? (
          <div className="uploadProgressFill uploadProgressFillIndeterminate" />
        ) : (
          <div className="uploadProgressFill" style={{ width: `${clamped}%` }} />
        )}
      </div>
      {scanning ? (
        <span className="muted small uploadProgressPct">…</span>
      ) : (
        <span className="muted small uploadProgressPct">{clamped}%</span>
      )}
    </div>
  )
}
