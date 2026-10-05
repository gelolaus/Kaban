import { expect, test } from 'vitest'
import {
  initialMoneyField,
  moneyErrorMessage,
  reduceMoneyField,
  shouldSubmitOnEnter,
} from './moneyField.ts'

test('typing does not set error', () => {
  let s = initialMoneyField()
  s = reduceMoneyField(s, { type: 'input', text: '12,00.5x' }, true)
  expect(s.error).toBeNull()
  expect(s.centavos).toBeNull()
})

test('blur validates invalid', () => {
  let s = initialMoneyField()
  s = reduceMoneyField(s, { type: 'input', text: '12,00.5x' }, true)
  s = reduceMoneyField(s, { type: 'blur' }, true)
  expect(s.error).toBe('invalid')
})

test('correction clears error', () => {
  let s = initialMoneyField()
  s = reduceMoneyField(s, { type: 'input', text: '12,00.5x' }, true)
  s = reduceMoneyField(s, { type: 'blur' }, true)
  s = reduceMoneyField(s, { type: 'input', text: '1,200.50' }, true)
  expect(s.error).toBeNull()
  s = reduceMoneyField(s, { type: 'blur' }, true)
  expect(s.centavos).toBe(120050)
})

test('empty optional', () => {
  let s = initialMoneyField()
  s = reduceMoneyField(s, { type: 'blur' }, false)
  expect(s.error).toBeNull()
  expect(s.centavos).toBeNull()
})

test('empty required', () => {
  let s = initialMoneyField()
  s = reduceMoneyField(s, { type: 'blur' }, true)
  expect(s.error).toBe('empty')
})

test('negative on blur', () => {
  let s = initialMoneyField()
  s = reduceMoneyField(s, { type: 'input', text: '-5' }, true)
  s = reduceMoneyField(s, { type: 'blur' }, true)
  expect(s.error).toBe('negative')
})

test('message table covers all errors', () => {
  for (const key of Object.keys(moneyErrorMessage)) {
    expect(moneyErrorMessage[key as keyof typeof moneyErrorMessage]).toBeTruthy()
  }
})

test('shouldSubmitOnEnter', () => {
  expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: true })).toBe(false)
  expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: false })).toBe(true)
  expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: false, shiftKey: true })).toBe(false)
  expect(shouldSubmitOnEnter({ key: 'a', isComposing: false })).toBe(false)
})
