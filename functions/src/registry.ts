import type { Checker } from './checker'
import { fx } from './checkers/fx'
import { kraken } from './checkers/kraken'

/** Order is the order rows appear in the Admin table. */
export const checkers: Checker[] = [
  fx,
  kraken,
]
