import Link from 'next/link';
import { Brand } from '@/components/ui/common';
export default function NotFound() { return <main className="workspace-loading"><Brand /><h1>Page not found</h1><p>The page may have moved. Return to the clinic’s home page.</p><Link href="/" className="button button-primary" style={{ marginTop: 24 }}>Go to home</Link></main>; }
