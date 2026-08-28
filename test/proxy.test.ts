import assert from 'node:assert/strict'
import test from 'node:test'
import { onRequest } from '../functions/api/[[path]].ts'
import worker from '../worker/index.ts'

test('proxy keeps the configured origin and removes Access cookies', async () => {
  const originalFetch = globalThis.fetch
  let forwardedRequest: Request | undefined

  globalThis.fetch = async (input) => {
    forwardedRequest = new Request(input)
    return new Response('{}', {
      headers: {
        'set-cookie': 'CF_Authorization=private',
        'x-upstream': 'worker',
      },
    })
  }

  try {
    const response = await onRequest({
      request: new Request(
        'https://diary.pages.dev/api///outside.example/path?q=%2B',
      ),
      env: {
        BACKEND_URL: 'https://worker.example/base/',
        CF_ACCESS_CLIENT_ID: 'id',
        CF_ACCESS_CLIENT_SECRET: 'secret',
      },
    })

    assert.equal(
      forwardedRequest?.url,
      'https://worker.example/base/outside.example/path?q=%2B',
    )
    assert.equal(forwardedRequest?.headers.get('CF-Access-Client-Id'), 'id')
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(response.headers.get('x-upstream'), 'worker')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('worker converts VPC connection failures to 502', async () => {
  const originalConsoleError = console.error
  console.error = () => undefined

  try {
    const response = await worker.fetch(
      new Request('https://worker.example/diary'),
      {
        BACKEND: {
          fetch: async () => {
            throw new Error('connection_refused')
          },
        },
      },
    )

    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { message: 'Backend unavailable' })
  } finally {
    console.error = originalConsoleError
  }
})
