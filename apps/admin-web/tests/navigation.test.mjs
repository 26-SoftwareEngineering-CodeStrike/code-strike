import assert from 'node:assert/strict'
import test from 'node:test'
import { adminReturnPath } from '../src/router/navigation.ts'

test('return from login preserves moderation filters and accepts only local admin screens', () => {
  assert.equal(adminReturnPath('/moderation?queue=Recruitment&status=Approved'), '/moderation?queue=Recruitment&status=Approved')
  for (const value of ['//elsewhere.test', 'https://elsewhere.test', '/login', '/unknown', ['/competitions']]) {
    assert.equal(adminReturnPath(value), '/')
  }
})
