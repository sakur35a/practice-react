interface Env {
  BACKEND: Fetcher
}

interface Fetcher {
  fetch(request: Request): Promise<Response>
}

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    url.protocol = 'http:'
    url.host = 'backend'
    return env.BACKEND.fetch(new Request(url, request))
  },
}
