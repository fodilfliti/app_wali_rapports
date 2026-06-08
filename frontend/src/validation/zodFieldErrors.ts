import type { ZodError } from 'zod'

export type FieldErrors = Record<string, string>

export function zodToFieldErrors(error: ZodError): { fieldErrors: FieldErrors; formError: string } {
  const fieldErrors: FieldErrors = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message
  }
  const formError = Object.keys(fieldErrors).length ? 'validationFixFields' : 'validationRequired'
  return { fieldErrors, formError }
}

export function focusFirstInvalidField(fieldErrors: FieldErrors, orderedFieldIds: string[]) {
  for (const id of orderedFieldIds) {
    const key = id.replace(/^#/, '')
    if (fieldErrors[key]) {
      const el = document.getElementById(id.startsWith('#') ? id.slice(1) : id)
      el?.focus()
      break
    }
  }
}
