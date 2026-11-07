// This is a transport adapter only. Authentication, permissions and database
// access live in the separately running Express application.
export function clinicApiOrigin() {
  return process.env.CLINIC_API_ORIGIN || 'http://127.0.0.1:3001';
}

export async function backendRequest(request: Request): Promise<Response> {
  const origin = clinicApiOrigin();
  const incoming = new URL(request.url); const target = new URL(incoming.pathname + incoming.search, origin);
  try {
    const headers = new Headers(request.headers);
    headers.delete('host'); headers.delete('connection'); headers.delete('content-length');
    const response = await fetch(target, { method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('set-cookie');
    for (const cookie of response.headers.getSetCookie()) {
      // The browser-facing connection can be HTTPS even with a local HTTP API.
      responseHeaders.append('set-cookie', incoming.protocol === 'https:' && !/;\s*secure\s*(?:;|$)/i.test(cookie) ? `${cookie}; Secure` : cookie);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  } catch {
    const reading = ['GET', 'HEAD'].includes(request.method);
    return Response.json({
      code: reading ? 'CLINIC_UNAVAILABLE' : 'SAVE_NOT_CONFIRMED',
      error: reading ? 'The clinic service is unavailable. Start the backend and try again.' : 'The clinic connection was interrupted. Refresh the records to check whether your change was saved before trying again.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '1' } });
  }
}
