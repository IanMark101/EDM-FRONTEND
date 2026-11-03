import type { ReactNode } from 'react';
import Link from 'next/link';

// CareRecord adaptation of Ruixen UI's configurable column/footer pattern.
// Reference: 21st.dev/@ruixen.ui/components/footer-1 and the public CorporateFooter.
// Copyright (c) 2025 Ruixen UI. License: docs/licenses/Ruixen-UI-LICENSE.txt.
type FooterColumn = { title: string; links: { label: string; href: string }[] };

export function Footer({ brand, description, columns, copyright }: {
  brand: ReactNode;
  description: string;
  columns: FooterColumn[];
  copyright: string;
}) {
  return <footer className="site-footer">
    <div className="site-footer-inner section-container">
      <div className="site-footer-main">
        <div className="site-footer-brand">{brand}<p>{description}</p></div>
        <nav className="site-footer-navigation" aria-label="Footer navigation">
          {columns.map(column => <div className="site-footer-column" key={column.title}>
            <h2>{column.title}</h2>
            <ul>{column.links.map(link => <li key={link.label}><Link href={link.href}>{link.label}</Link></li>)}</ul>
          </div>)}
        </nav>
      </div>
      <div className="site-footer-bottom"><p>{copyright}</p><p>Connected records. Clear responsibilities.</p></div>
    </div>
  </footer>;
}
