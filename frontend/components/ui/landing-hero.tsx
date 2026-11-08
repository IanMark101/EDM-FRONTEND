import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="clinic-hero" aria-labelledby="clinic-hero-title">
      <div className="clinic-hero-inner">
        <div className="clinic-hero-copy">
          <h1 id="clinic-hero-title">A clear record<br />of care</h1>
          <p>Patient visits, test reports and payments, connected for the people responsible for care.</p>
          <div className="clinic-hero-actions">
            <Link className="button button-primary" href="/login">Staff sign-in<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className="button button-secondary" href="/patient">Patient sign-in</Link>
          </div>
        </div>
        <figure className="clinic-hero-preview">
          <img src="/images/patients.jpg" alt="CareRecord reception work list with patient records and check-in actions" width={1440} height={900} fetchPriority="high" />
          <figcaption>Patient reception workspace with sample records</figcaption>
        </figure>
      </div>
    </section>
  );
}
