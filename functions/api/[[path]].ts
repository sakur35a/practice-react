interface Env {
  BACKEND_URL?: string
  CF_ACCESS_CLIENT_ID?: string
  CF_ACCESS_CLIENT_SECRET?: string
}

interface FunctionContext {
  request: Request
  env: Env
}

type PagesFunction = (context: FunctionContext) => Response | Promise<Response>

export const onRequest: PagesFunction = async ({ request, env }) => {
  if (!env.BACKEND_URL) {
    return Response.json(
      { message: 'BACKEND_URL is not configured' },
      { status: 500 },
    )
  }

  let backendBaseUrl: URL

  try {
    backendBaseUrl = new URL(env.BACKEND_URL)
  } catch {
    return Response.json(
      { message: 'BACKEND_URL is invalid' },
      { status: 500 },
    )
  }

  if (!['http:', 'https:'].includes(backendBaseUrl.protocol)) {
    return Response.json(
      { message: 'BACKEND_URL must use HTTP or HTTPS' },
      { status: 500 },
    )
  }

  if (!backendBaseUrl.pathname.endsWith('/')) {
    backendBaseUrl.pathname += '/'
  }

  const incomingUrl = new URL(request.url)
  const apiPath = incomingUrl.pathname.replace(/^\/api\/?/, '')
  const targetUrl = new URL(apiPath, backendBaseUrl)
  targetUrl.search = incomingUrl.search

  const backendRequest = new Request(targetUrl, request)
  backendRequest.headers.delete('host')
  backendRequest.headers.delete('content-length')
  backendRequest.headers.delete('origin')
  backendRequest.headers.delete('referer')

  const hasAccessClientId = Boolean(env.CF_ACCESS_CLIENT_ID)
  const hasAccessClientSecret = Boolean(env.CF_ACCESS_CLIENT_SECRET)

  if (hasAccessClientId !== hasAccessClientSecret) {
    return Response.json(
      { message: 'Cloudflare Access credentials are incomplete' },
      { status: 500 },
    )
  }

  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    backendRequest.headers.set('CF-Access-Client-Id', env.CF_ACCESS_CLIENT_ID)
    backendRequest.headers.set(
      'CF-Access-Client-Secret',
      env.CF_ACCESS_CLIENT_SECRET,
    )
  }

  try {
    return await fetch(backendRequest)
  } catch {
    return Response.json(
      { message: 'Backend request failed' },
      { status: 502 },
    )
  }
}
