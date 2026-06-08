type Props = { text: string | null }

export function FieldErrorText({ text }: Props) {
  if (!text) return null
  return <div className="fieldError">{text}</div>
}
