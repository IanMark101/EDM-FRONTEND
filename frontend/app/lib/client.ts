'use client';
export async function clinicRequest(path: string, body?: any) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try { response = await fetch(`/api/${path}`, body === undefined ? { cache: 'no-store', signal: controller.signal } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }); }
  catch (error) { if (error instanceof Error && error.name === 'AbortError') throw new Error('This took too long. Refresh the records before trying again.'); throw error; }
  finally { clearTimeout(timeout); }
  const result: any = await response.json();
  if (!response.ok) { if (response.status === 401) window.location.assign('/login?expired=1'); throw new Error(result.error || 'This action could not be completed.'); }
  return result;
}
