"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import styles from './Header.module.css';

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu automatically when route changes
  useEffect(() => {
    // schedule closing the mobile menu after the route changes to avoid
    // triggering a synchronous state update inside the effect body.
    if (!open) return;
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname, open]);

  return (
  <header className={`relative ${open ? 'menu-open' : ''}`}>
  <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 h-full">
          {!open && (
            <Link href="/" className="flex items-center gap-3 h-full">
              <Image
                src="/chartegraphique/FluffRadio-CharteGraphique-Noka-x-Pawl/FluffRadio-CG-Full/LivreePNG-FluffRadio-Communication-Livery/FluffRadio-logo-color-livery.png"
                alt="Logo Fluff Radio"
                className="top-logo rounded-md"
                width={140}
                height={40}
                priority={true}
              />
              <div className="hidden md:block">
                <h1 className="text-2xl font-bold leading-tight">Fluff Radio</h1>
                <p className="text-sm opacity-80">Panneau d&apos;administration</p>
              </div>
            </Link>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-6 text-base md:text-lg">
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/dashboard" className="hover:underline">Musics</Link>
          <Link href="/api/admin/cache" className="hover:underline">Cache</Link>
          <Link href={process.env.NEXT_PUBLIC_STREAM_URL ?? "#"} className={`${styles.listenButton} ml-4`} aria-label="Écouter Fluff Radio">
            <span className={styles.icon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
              </svg>
            </span>
            <span className="ml-2 font-semibold">Écouter</span>
            <span className={styles.liveDot} aria-hidden="true" />
          </Link>
        </nav>

        <div className="md:hidden">
          <button
            aria-label="Ouvrir le menu"
            onClick={() => setOpen(!open)}
            className="p-2 rounded-md border border-transparent hover:bg-white/5 transition"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-current">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="md:hidden px-4 pb-4">
            {/* Mobile row: left = logoArea, right = menuPanel */}
            <div className={styles.mobileRow}>
              <div className={styles.logoArea}>
                <Link href="/" className="block" onClick={() => setOpen(false)}>
                  <Image
                    src="/chartegraphique/FluffRadio-CharteGraphique-Noka-x-Pawl/FluffRadio-CG-Full/LivreePNG-FluffRadio-Communication-Livery/FluffRadio-logo-color-livery.png"
                    alt="Logo Fluff Radio"
                    className={`${styles.logoBig} rounded-md`}
                    width={360}
                    height={160}
                    priority={false}
                  />
                </Link>
              </div>

              <div className={styles.menuPanel}>
                <nav className={`${styles.mobileNav} flex flex-col gap-2 p-3 rounded-lg shadow-sm`}>
                  <Link href="/dashboard" className="block py-2" onClick={() => setOpen(false)}>Dashboard</Link>
                  <Link href="/apropos" className="block py-2" onClick={() => setOpen(false)}>A propos</Link>
                  <Link href="/partenariats" className="block py-2" onClick={() => setOpen(false)}>Partenariats</Link>
                  <Link href={process.env.NEXT_PUBLIC_STREAM_URL ?? "#"} className={styles.listenMobile} aria-label="Écouter Fluff Radio" onClick={() => setOpen(false)}>
                    <span className={styles.icon} aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="ml-2">Écouter</span>
                    <span className={styles.liveDot} aria-hidden="true" />
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
