export interface RecordedRequest {
  method: string
  url: URL
  headers: Record<string, string>
  body: unknown
  signal: AbortSignal | null
}

type Responder = Response | ((request: RecordedRequest) => Response | Promise<Response>)

interface ReplyInit {
  status?: number
  body?: unknown
  contentType?: string | null
}

export function reply({ status = 200, body, contentType = 'application/json' }: ReplyInit = {}): Response {
  const payload = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body)

  return new Response(payload, {
    status,
    headers: contentType ? { 'content-type': contentType } : {},
  })
}

export function failWith(status: number, code: string, message = code): Response {
  return reply({ status, body: { code, message } })
}

function decodeBody(body: RequestInit['body']): unknown {
  if (typeof body !== 'string') return body ?? undefined

  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

export function mockFetch(...responders: Responder[]) {
  const requests: RecordedRequest[] = []

  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const request: RecordedRequest = {
      method: init.method ?? 'GET',
      url: new URL(String(input)),
      headers: { ...(init.headers as Record<string, string>) },
      body: decodeBody(init.body),
      signal: init.signal ?? null,
    }

    requests.push(request)

    const next = responders.shift() ?? reply({ body: {} })

    return typeof next === 'function' ? next(request) : next
  })

  return {
    fetchMock,
    requests,
    lastRequest(): RecordedRequest {
      const request = requests.at(-1)

      if (!request) throw new Error('fetch was not called')

      return request
    },
  }
}
