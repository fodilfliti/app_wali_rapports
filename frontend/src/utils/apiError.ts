export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string>

  constructor(
    status: number,
    error: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(error)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}
