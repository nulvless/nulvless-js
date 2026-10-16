function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

export function jwt(payload: Record<string, unknown>): string {
  return [base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' })), base64Url(JSON.stringify(payload)), 'signature'].join('.')
}
