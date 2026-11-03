'use client';
import { Brand } from '@/components/ui/common';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="workspace-loading"><Brand /><h1>The clinic could not load</h1><p>Please try again. Your saved records have not been removed.</p><button className="button button-primary" onClick={reset} style={{ marginTop: 24 }}>Try again</button></main>; }
