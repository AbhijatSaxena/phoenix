import type { Checker } from './checker'
import { fx } from './checkers/fx'

/** Order is the order rows appear in the Admin table. */
export const checkers: Checker[] = [
  fx,
]
