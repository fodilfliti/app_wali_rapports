type Props = {
  percent: number
  label?: string
}

export function UploadProgressBar({ percent, label }: Props) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="uploadProgress" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      {label ? <span className="muted small uploadProgressLabel">{label}</span> : null}
      <div className="uploadProgressTrack">
        <div className="uploadProgressFill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="muted small uploadProgressPct">{clamped}%</span>
    </div>
  )
}
