'use client';
import { useRef, useEffect, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

// Adapted from Manu Arora's MIT Container Scroll source supplied by the user.
// Only this showcase tilts with scrolling; the feature sections remain in place.
export function ShowcaseFrame({ children, title = 'CareRecord / Clinic workspace', label = 'Staff view', className = '' }: { children: ReactNode; title?: string; label?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 95%', 'start 20%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [.96, 1]);
  return <div className={`container-scroll ${className}`} ref={ref}><div className="scroll-perspective"><motion.div className="scroll-device" style={mounted && reduced ? { rotateX: 0, scale: 1 } : { rotateX, scale }}>
    <div className="device-toolbar"><span className="device-dots" aria-hidden="true"><i /><i /><i /></span><span className="device-title">{title}</span><span className="device-demo">{label}</span></div>
    <div className="device-screen">{children}</div>
  </motion.div></div></div>;
}
