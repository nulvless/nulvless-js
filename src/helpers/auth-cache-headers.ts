/**
 * Headers that keep a response carrying auth state out of every cache.
 *
 * `no-store` alone covers HTTP/1.1; `Pragma` and `Expires` cover HTTP/1.0 caches
 * and proxies that predate it. RFC 6749 §5.1 and OpenID Connect Core §3.1.3.3
 * both require the first two on any response carrying a token.
 */
export const AUTH_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
} as const

interface WebResponseLike {
  headers: { set(name: string, value: string): void }
}

interface NodeResponseLike {
  setHeader(name: string, value: string): unknown
}

function isNodeResponse(response: unknown): response is NodeResponseLike {
  return typeof (response as NodeResponseLike).setHeader === 'function'
}

function isWebResponse(response: unknown): response is WebResponseLike {
  const headers = (response as WebResponseLike).headers

  return typeof headers?.set === 'function'
}

/**
 * Marks a response as carrying auth state so no cache stores it, and returns it
 * so the call can be inlined into a `return`.
 *
 * Apply this to **your own** response whenever it sets, rotates or clears a
 * session — sign-in, refresh, sign-out. A CDN that caches such a response serves
 * one visitor's session cookie to the next, signing them in as someone else; it
 * is a failure that has happened in production on CloudFront, Vercel Edge and
 * Cloudflare. The usual protection does not apply here: shared caches are barred
 * from reusing responses to requests carrying `Authorization`, but yours is
 * authenticated by cookie, which carries no such rule.
 *
 * Accepts a Web `Response` (Next.js App Router, Workers, Deno) or a Node
 * `ServerResponse` (Express, Next.js Pages Router). Use {@link AUTH_CACHE_HEADERS}
 * directly where a framework takes a plain header map instead.
 *
 * @example
 * // Next.js App Router
 * export async function POST(request: Request) {
 *   const { data } = await nulvless.auth.signIn(params, {
 *     headers: forwardUserHeaders(request),
 *   })
 *
 *   const response = NextResponse.json({ ok: true })
 *   response.cookies.set('session', data.access_token)
 *
 *   return applyAuthCacheHeaders(response)
 * }
 *
 * @example
 * // Express
 * app.post('/login', async (req, res) => {
 *   const { data } = await nulvless.auth.signIn(params, {
 *     headers: forwardUserHeaders(req),
 *   })
 *
 *   applyAuthCacheHeaders(res)
 *   res.cookie('session', data.access_token, { httpOnly: true, sameSite: 'lax' })
 *   res.json({ ok: true })
 * })
 */
export function applyAuthCacheHeaders<T>(response: T): T {
  const entries = Object.entries(AUTH_CACHE_HEADERS)

  if (isWebResponse(response)) {
    for (const [name, value] of entries) response.headers.set(name, value)
  } else if (isNodeResponse(response)) {
    for (const [name, value] of entries) response.setHeader(name, value)
  }

  return response
}
