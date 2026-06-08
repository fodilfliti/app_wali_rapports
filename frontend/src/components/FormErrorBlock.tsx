type Props = { message: string | null }

export function FormErrorBlock({ message }: Props) {
  if (!message) return null
  return <div className="formErrorBlock">{message}</div>
}
