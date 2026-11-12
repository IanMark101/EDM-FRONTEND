// This is a transport adapter only. Authentication, permissions and database
// access live in the separately running Express application.
export function clinicApiOrigin() {
  return process.env.CLINIC_API_ORIGIN || 'http://127.0.0.1:3001';
}

const MAX_BODY_BYTES = 100_000;
let lastConnectionWarning = 0;
async function boundedBody(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const buffer = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return buffer.subarray(0, size);
      if (size + chunk.value.byteLength > MAX_BODY_BYTES) return null;
      buffer.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function backendRequest(request: Request): Promise<Response> {
  const origin = clinicApiOrigin();
  const incoming = new URL(request.url); const target = new URL(incoming.pathname + incoming.search, origin);
  const reading = ['GET', 'HEAD'].includes(request.method);
  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await boundedBody(request);
    if (body === null) return Response.json({ error: 'This submission is too large.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
    const headers = new Headers(request.headers);
    headers.delete('host'); headers.delete('connection'); headers.delete('content-length');
    const options: RequestInit = { method: request.method, headers, body,
      redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30_000) };
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      try { response = await fetch(target, options); break; }
      catch (error) {
        // A dev-server restart can briefly refuse connections. Reads may be
        // retried, but a write might already have committed before disconnecting.
        if (!reading || attempt >= 2 || options.signal?.aborted) throw error;
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 250 : 750));
      }
    }
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('set-cookie');
    responseHeaders.delete('connection');
    for (const cookie of response.headers.getSetCookie()) {
      // The browser-facing connection can be HTTPS even with a local HTTP API.
      responseHeaders.append('set-cookie', incoming.protocol === 'https:' && !/;\s*secure\s*(?:;|$)/i.test(cookie) ? `${cookie}; Secure` : cookie);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  } catch (error) {
    if (Date.now() - lastConnectionWarning > 30_000) {
      lastConnectionWarning = Date.now();
      const failure = error as { name?: string; cause?: { code?: string } };
      console.warn('Clinic API connection failed', { method: request.method, area: incoming.pathname.split('/')[2], code: failure.cause?.code || failure.name || 'Unknown' });
    }
    return Response.json({
      code: reading ? 'CLINIC_UNAVAILABLE' : 'SAVE_NOT_CONFIRMED',
      error: reading ? 'The clinic connection is temporarily unavailable. The work list will retry automatically; you can also try again.' : 'The clinic connection was interrupted. Refresh the records to check whether your change was saved before trying again.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '1' } });
  }
}
