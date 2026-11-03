'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Brand } from '@/components/ui/common';
import { ShowcaseFrame } from '@/components/ui/showcase-frame';
import { OrbitalGalleryHero } from '@/components/ui/orbital-gallery-hero';
import { Footer } from '@/components/ui/footer-1';
import { WorkspacePreview, DemoFragment, VisitJourney, AccessComparison, ReportingPreview, DocumentPreview } from './landing-fragments';

const SCREEN_VIEWS = [
  { id: 'patients', label: 'Patient records', path: '/images/patients.jpg' },
  { id: 'laboratory', label: 'Laboratory', path: '/images/laboratory.jpg' },
  { id: 'review', label: 'Record checks', path: '/images/review.jpg' },
  { id: 'reports', label: 'Reports', path: '/images/reports.jpg' },
];

export function Landing() {
  const [view, setView] = useState('patients');
  const [imagesReady, setImagesReady] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = main.current?.querySelectorAll('[data-landing-motion]');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-landing-visible', '');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -9% 0px' });
    targets?.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all(SCREEN_VIEWS.map(view => new Promise<boolean>(resolve => {
      const image = new Image(); image.onload = () => resolve(true); image.onerror = () => resolve(false); image.src = view.path;
    }))).then(results => { if (!cancelled) setImagesReady(results.every(Boolean)); });
    return () => { cancelled = true; };
  }, []);
  const screen = SCREEN_VIEWS.find(v => v.id === view)!;
  function moveTab(event: React.KeyboardEvent<HTMLButtonElement>) {
    const i = SCREEN_VIEWS.findIndex(v => v.id === view);
    const next = event.key === 'ArrowRight' ? (i + 1) % SCREEN_VIEWS.length : event.key === 'ArrowLeft' ? (i + SCREEN_VIEWS.length - 1) % SCREEN_VIEWS.length : event.key === 'Home' ? 0 : event.key === 'End' ? SCREEN_VIEWS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); setView(SCREEN_VIEWS[next].id);
    document.getElementById(`showcase-tab-${SCREEN_VIEWS[next].id}`)?.focus();
  }
  return <div className="landing" id="landing-top">
    <header className="landing-header">
      <Brand />
      <nav aria-label="Main navigation"><a href="#workflow">Patient visits</a><a href="#checks">Record checks</a><a href="#responsibilities">Staff access</a><a href="#reporting">Reports</a><a href="#documents">Documents</a></nav>
      <Link className="text-link" href="/login">Staff sign-in<ArrowRight size={15} /></Link>
    </header>
    <main ref={main}>
      <OrbitalGalleryHero />
      <FeatureSections workspacePreview={<div className="visit-workspace-showcase"><ShowcaseFrame>
        <div data-ui>
          {imagesReady ? <div role="tabpanel" id="showcase-panel" aria-labelledby={`showcase-tab-${view}`}>
            <img className="showcase-image" src={screen.path} alt={`CareRecord ${screen.label.toLowerCase()} staff workspace`} width={1440} height={900} />
          </div> : <WorkspacePreview view={view} />}
        </div>
      </ShowcaseFrame>
      <div className="showcase-tabs" role="tablist" aria-label="Explore clinic screens">
        {SCREEN_VIEWS.map(v => <button type="button" key={v.id} id={`showcase-tab-${v.id}`} role="tab" aria-selected={view === v.id} aria-controls="showcase-panel" onKeyDown={moveTab} onClick={() => setView(v.id)}>{v.label}</button>)}
      </div></div>} />
      <section className="landing-faq" id="questions">
        <div data-landing-motion="copy"><h2>Clear answers<br />before you start</h2><p>How the clinic’s work stays connected, from a patient’s arrival to the saved report.</p></div>
        <div className="landing-faq-list" data-landing-motion="questions">
          <details open><summary>How does a visit move between staff?<ArrowRight className="faq-arrow" size={17} aria-hidden="true" /></summary><p>Registration checks in the patient. The assigned doctor records the consultation and requests tests when needed. Laboratory staff approve reports. The doctor records a review and follow-up decision, then completes the consultation. Billing staff prepare charges and record payments.</p></details>
          <details><summary>How are staff roles assigned?<ArrowRight className="faq-arrow" size={17} aria-hidden="true" /></summary><p>An account manager assigns individual accounts and responsibilities. Staff can change their password privately. A temporary password must be replaced before opening patient records.</p></details>
          <details><summary>What happens when information is wrong?<ArrowRight className="faq-arrow" size={17} aria-hidden="true" /></summary><p>Missing details and uncertain patient matches go to the responsible staff for checking. Corrections keep the earlier approved or signed content and the reason for the change. A corrected test report needs a new doctor review.</p></details>
          <details><summary>What information is used for reports?<ArrowRight className="faq-arrow" size={17} aria-hidden="true" /></summary><p>The records reviewer updates selected reporting copies and chooses the reporting period. Consultation counts use visit dates, test reports use approval dates, and receipts use payment dates. Private notes and result values stay outside the reporting collection.</p></details>
          <details><summary>Can staff print a saved record?<ArrowRight className="faq-arrow" size={17} aria-hidden="true" /></summary><p>Authorized staff can print completed consultation summaries, approved test reports, bills and individual payment receipts, or save them as PDF. Draft clinical reports stay inside the working process.</p></details>
          <details><summary>How are records backed up?<ArrowRight className="faq-arrow" size={17} aria-hidden="true" /></summary><p>The local backup service creates encrypted copies while the clinic service is running. The installation administrator manages recovery keys, protected copies on a separate device and restore tests.</p></details>
        </div>
      </section>
    </main>
    <Footer brand={<Brand />} description="Patient visits, laboratory reports and payments, connected for your clinic." copyright={`© ${new Date().getFullYear()} CareRecord. All rights reserved.`} columns={[
      { title: 'Patient care', links: [{ label: 'Patient visits', href: '#workflow' }, { label: 'Test report checks', href: '#checks' }, { label: 'Saved documents', href: '#documents' }] },
      { title: 'Connected records', links: [{ label: 'Staff access', href: '#responsibilities' }, { label: 'Reports & analytics', href: '#reporting' }, { label: 'Common questions', href: '#questions' }] },
      { title: 'Workspace', links: [{ label: 'Staff sign-in', href: '/login' }, { label: 'Back to top', href: '#landing-top' }] },
    ]} />
  </div>;
}

function FeatureSections({ workspacePreview }: { workspacePreview: React.ReactNode }) {
  return <div className="feature-collection">
    <section className="visit-section section-container" id="workflow" aria-labelledby="workflow-title">
      <div className="section-intro" data-landing-motion="copy"><h2 id="workflow-title">One visit,<br />kept together</h2><p>Find the patient once, then follow the visit. Registration, the doctor, laboratory and billing each have a clear next task, linked to the same patient and visit numbers.</p></div>
      {workspacePreview}
      <VisitJourney />
    </section>
    <section className="quality-section" id="checks" aria-labelledby="checks-title">
      <div className="quality-layout section-container">
        <div className="quality-copy">
          <div className="quality-intro" data-landing-motion="copy"><h2 id="checks-title">Check before<br />approval</h2><p>Every result needs enough information for the laboratory to check it and for the doctor to review it later.</p></div>
          <ol className="quality-principles" data-landing-motion="checklist">
            <li><h3>Record the details</h3><p>Enter the result, its unit when applicable, and the sample time.</p></li>
            <li><h3>Check before release</h3><p>Reports with missing details stay in draft until laboratory staff complete and approve them.</p></li>
            <li><h3>Review the latest report</h3><p>Corrections keep the earlier report and the reason for the change. The doctor reviews the updated version.</p></li>
          </ol>
        </div>
        <div className="quality-proof" data-landing-motion="proof">
          <p className="proof-caption">Try the sample report. Check it with the time blank, then enter a time and check again.</p>
          <DemoFragment type={1} />
        </div>
      </div>
    </section>
    <section className="access-section" id="responsibilities" aria-labelledby="responsibilities-title">
      <div className="section-container">
        <div className="section-intro" data-landing-motion="copy"><h2 id="responsibilities-title">One patient.<br />A view for each job.</h2><p>The doctor needs clinical details. Billing needs services and payments. Individual accounts give each person the information and actions their job requires.</p></div>
        <AccessComparison />
        <div className="access-footer" data-landing-motion="copy"><p>Alerts take staff to their next task. Each staff member saves their own consultation, review, or payment in the workspace.</p><Link className="text-link" href="/login">Staff sign-in<ArrowRight size={16} /></Link></div>
      </div>
    </section>
    <section className="report-section section-container" id="reporting" aria-labelledby="reporting-title">
      <div className="section-intro" data-landing-motion="copy"><h2 id="reporting-title">Figures with<br />a clear source</h2><p>Understand completed consultations, approved tests, money received and remaining balances. Each reporting period has clear sources and a visible update time.</p></div><ShowcaseFrame title="CareRecord / Clinic reports" label="Report view" className="reporting-showcase"><ReportingPreview /></ShowcaseFrame>
      <p className="report-privacy">Private notes, test result values and contact details stay out of the reporting collection.</p>
    </section>
    <section className="documents-section" id="documents" aria-labelledby="documents-title"><div className="documents-layout section-container"><DocumentPreview /><div className="documents-copy" data-landing-motion="copy"><h2 id="documents-title">Saved records,<br />ready to share</h2><p>Give the patient a clear copy of the completed work. Authorized staff can print a saved document or save it as PDF.</p><dl><div><dt>Consultation summary</dt><dd>The doctor’s completed record, assessment and care plan.</dd></div><div><dt>Approved laboratory report</dt><dd>Named results, units, sample details and approval information.</dd></div><div><dt>Bill and payment receipt</dt><dd>Clear charges and a receipt for each payment received.</dd></div></dl><p className="documents-note">Printed copies identify the patient, visit and saved record. Access follows the staff member’s role.</p></div></div></section>
  </div>;
}
