'use client';

import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';

// Adapted from Designali's Orbital Gallery Hero source supplied by the user.
// Keep the orbit/counter-rotation; use the clinic's own screen images and copy.
const SCREENS = [
  { src: '/images/patients.jpg', label: 'Patient reception' },
  { src: '/images/laboratory.jpg', label: 'Laboratory work' },
  { src: '/images/reports.jpg', label: 'Reports & analytics' },
  { src: '/images/review.jpg', label: 'Record checks' },
];
const GALLERY = Array.from({ length: 10 }, (_, index) => SCREENS[index % SCREENS.length]);

export function OrbitalGalleryHero() {
  return (
    <section className="orbital-hero" aria-labelledby="orbital-title">
      <div className="orbital-gallery" aria-hidden="true">
        <div className="orbital-ring">
          {GALLERY.map((screen, index) => {
            const angle = index * 360 / GALLERY.length;
            return <div className="orbital-position" key={`${screen.src}-${index}`} style={{ transform: `rotate(${angle}deg) translateX(var(--orbit-radius)) rotate(${-angle}deg)` }}>
              <div className="orbital-card">
                <img src={screen.src} alt="" width={1440} height={900} draggable={false} />
              </div>
            </div>;
          })}
        </div>
      </div>
      <div className="orbital-copy">
        <h1 id="orbital-title">A clear record<br />of care</h1>
        <p>Patient visits, test reports and payments.<br className="orbital-copy-break" /> Connected for the people responsible for care.</p>
        <div className="orbital-actions">
          <Link className="button button-primary" href="/login">Open clinic<ArrowRight size={16} aria-hidden="true" /></Link>
          <a className="text-link" href="#workflow">See how it works<ArrowDown size={15} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
