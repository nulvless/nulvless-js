/**
 * Headers extracted from the user's browser request and forwarded to the
 * auth service so it can build an accurate session fingerprint (device,
 * browser, OS, IP-based location, etc.).
 */
const TRACKING_HEADERS = [
  'authorization',
  'user-agent',
  'host',
  'origin',
  'referer',
  'accept',
  'accept-language',
  'sec-fetch-dest',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'cloudfront-forwarded-proto',
] as const

type NodeHeaders = Record<string, string | string[] | undefined>

/**
 * Extracts user browser headers from an incoming server request and returns
 * them as a plain `Record<string, string>` ready to pass via `options.headers`.
 *
 * Accepts:
 * - **Web `Request`** — Next.js App Router, Cloudflare Workers, Deno
 * - **Node.js `IncomingMessage`** — Express, Next.js Pages Router, Fastify raw
 *
 * @example
 * // Next.js App Router
 * export async function POST(request: Request) {
 *   const { data } = await nulvless.auth.signIn(params, {
 *     headers: forwardUserHeaders(request),
 *   })
 * }
 *
 * @example
 * // Express / Next.js Pages Router
 * app.post('/login', async (req, res) => {
 *   const { data } = await nulvless.auth.signIn(params, {
 *     headers: forwardUserHeaders(req),
 *   })
 * })
 */
export function forwardUserHeaders(
  req: Request | { headers: NodeHeaders },
): Record<string, string> {
  const result: Record<string, string> = {}

  // Web Request API (Next.js App Router, Workers, Deno)
  if (typeof Request !== 'undefined' && req instanceof Request) {
    for (const key of TRACKING_HEADERS) {
      const val = req.headers.get(key)
      if (val) result[key] = val
    }
    return result
  }

  // Node.js IncomingMessage (Express, Next.js Pages Router)
  const nodeHeaders = (req as { headers: NodeHeaders }).headers
  for (const key of TRACKING_HEADERS) {
    const val = nodeHeaders[key]
    if (val) result[key] = Array.isArray(val) ? val[0]! : val
  }

  return result
}
