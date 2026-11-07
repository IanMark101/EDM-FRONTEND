'use client';
export async function clinicRequest(path: string, body?: any) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
  const reading = body === undefined;
  const pause = () => new Promise(resolve => setTimeout(resolve, 300));
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response; let result: any;
      try {
        response = await fetch(`/api/${path}`, reading ? { cache: 'no-store', signal: controller.signal } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
        result = await response.json();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw new Error(reading ? 'Refreshing took too long. Your last loaded records remain available; try again.' : 'We could not confirm whether your change was saved. Refresh the records before trying again.');
        if (reading && attempt === 0) { await pause(); continue; }
        throw new Error(reading ? 'The clinic connection was interrupted. Try refreshing the records again.' : 'We could not confirm whether your change was saved. Refresh the records before trying again.');
      }
      // A GET may be repeated safely. Never resubmit a price change, bill or
      // payment automatically when its first response might have been lost.
      if (reading && response.status === 503 && attempt === 0) { await pause(); continue; }
      if (!response.ok) {
        if (response.status === 401) {
          if (path === 'patient-portal') window.location.assign('/patient?expired=1');
          else if (!path.startsWith('patient-portal/')) window.location.assign('/login?expired=1');
        }
        throw new Error(result.error || 'This action could not be completed.');
      }
      return result;
    }
  } finally { clearTimeout(timeout); }
}
