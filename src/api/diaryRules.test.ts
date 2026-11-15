import assert from 'node:assert/strict'
import { test } from 'node:test'
import { containsNul, countCodePoints, TITLE_MAX_CODE_POINTS, validateDiary } from './diaryRules.ts'

test('코드 포인트를 센다 (UTF-16 길이와 다르다)', () => {
  assert.equal(countCodePoints(''), 0)
  assert.equal(countCodePoints('일기'), 2)
  assert.equal(countCodePoints('😀'), 1)
  assert.equal('😀'.length, 2)
  assert.equal(countCodePoints('a😀b'), 3)
  assert.equal(countCodePoints('👨‍👩‍👧'), 5) // 가족 이모지는 코드 포인트 5개(서버도 이렇게 센다)
  assert.equal(countCodePoints('\ud800'), 1) // 짝 없는 서로게이트는 1
  assert.equal(countCodePoints('\ud800a'), 2)
})

test('255 코드 포인트는 통과하고 256은 too-long이다 (이모지 포함)', () => {
  assert.deepEqual(validateDiary({ title: 'a'.repeat(255), content: 'x' }), {})
  assert.deepEqual(validateDiary({ title: '😀'.repeat(255), content: 'x' }), {}) // UTF-16으로는 510
  assert.deepEqual(validateDiary({ title: 'a'.repeat(256), content: 'x' }), { title: ['too-long'] })
  assert.deepEqual(validateDiary({ title: `${'😀'.repeat(255)}😀`, content: 'x' }), { title: ['too-long'] })
  assert.equal(TITLE_MAX_CODE_POINTS, 255)
})

test('서버로 보내는 trim한 값으로 센다', () => {
  assert.deepEqual(validateDiary({ title: `  ${'a'.repeat(255)}  `, content: 'x' }), {})
})

test('NUL 문자를 찾는다', () => {
  assert.ok(containsNul('a\u0000b'))
  assert.ok(!containsNul('ab'))
  assert.deepEqual(validateDiary({ title: 'a\u0000', content: 'x' }), { title: ['nul-character'] })
  assert.deepEqual(validateDiary({ title: 'a', content: 'x\u0000y' }), { content: ['nul-character'] })
  assert.deepEqual(validateDiary({ title: `${'a'.repeat(256)}\u0000`, content: '\u0000' }), {
    title: ['too-long', 'nul-character'],
    content: ['nul-character'],
  })
})

test('빈 제목과 빈 본문은 서버가 받으므로 막지 않는다', () => {
  assert.deepEqual(validateDiary({ title: '', content: '' }), {})
  assert.deepEqual(validateDiary({ title: '   ', content: ' \n ' }), {})
})
