import { z } from 'zod';



/**

 * Entity identifier — string for BIGINT and UUID public ids.

 * UUID cutover (Phase P5) will tighten `entityIdSchema` to `z.string().uuid()`.

 */

export type EntityId = string;



/** Permissive during BIGINT→UUID transition; tighten to `.uuid()` after cutover. */

export const entityIdSchema = z.union([

  z.string().uuid(),

  z.string().regex(/^\d+$/),

]);

