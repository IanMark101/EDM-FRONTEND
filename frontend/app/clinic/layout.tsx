import type { ReactNode } from 'react';
import { clinicApiOrigin } from '@/app/lib/backend';
import { ClinicApp } from './[[...path]]/workspace';

// Keep the workspace and permitted records mounted while staff move between pages.
// Each dynamic page still verifies its session on the server.
export default function ClinicLayout({ children }: { children: ReactNode }) {
  const upstream = new URL(clinicApiOrigin());
  const localNotificationPort = upstream.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname)
    ? upstream.port || '80'
    : undefined;
  return <><ClinicApp localNotificationPort={localNotificationPort} />{children}</>;
}
