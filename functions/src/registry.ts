import type { Checker } from './checker'
import { fx } from './checkers/fx'
import { kraken } from './checkers/kraken'
import { krakenFutures } from './checkers/krakenFutures'

/** Order is the order rows appear in the Admin table. */
export const checkers: Checker[] = [
  fx,
  kraken,
  krakenFutures,
]
