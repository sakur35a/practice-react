interface Env {
  BACKEND: Fetcher
}

interface Fetcher {
  fetch(request: Request): Promise<Response>
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    url.protocol = 'http:'
    url.host = 'backend'

    try {
      return await env.BACKEND.fetch(new Request(url, request))
    } catch (error) {
      console.error('VPC request failed', {
        method: request.method,
        pathname: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      })

      return Response.json(
        { message: 'Backend unavailable' },
        { status: 502 },
      )
    }
  },
}
