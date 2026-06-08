import { z } from 'zod'
import { V } from '../messages'

export const changeCodeSchema = z.object({
  current_code: z.string().min(1, V.required),
  new_code: z.string().trim().min(8, 'passwordMinLength').max(128, V.maxLength),
})
