import type { RecordedRequest } from './fetch'

export interface ExpectedRequest {
  method: string
  path: string
  query?: Record<string, string>
  body?: unknown
  nonce?: string
  apiKey?: boolean
}

export function expectRequest(request: RecordedRequest, basePath: string, expected: ExpectedRequest): void {
  expect({
    method: request.method,
    path: request.url.pathname,
    query: Object.fromEntries(request.url.searchParams),
    body: request.body,
    nonce: request.headers['nlv-sudo-nonce'],
    apiKey: 'x-platform-key' in request.headers,
  }).toEqual({
    method: expected.method,
    path: `${basePath}${expected.path}`,
    query: expected.query ?? {},
    body: expected.body,
    nonce: expected.nonce,
    apiKey: expected.apiKey ?? true,
  })
}
