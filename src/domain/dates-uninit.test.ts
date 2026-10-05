import { expect, test } from 'vitest'
import { temporal } from './dates.ts'

test('temporal throws before init', () => {
  expect(() => temporal()).toThrow('Temporal not initialised')
})
