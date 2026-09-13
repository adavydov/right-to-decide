"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/essence/", label: "Суть" },
  { href: "/read/", label: "Читать" },
  { href: "/library/", label: "Библиотека" },
  { href: "/authors/", label: "Авторы" },
] as const;

export function BookHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <a href="#main-content" className="skip-link">К содержимому</a>
      <header className="v101-header">
        <nav className="v101-nav" aria-label="Основная навигация">
          <Link href="/" className="v101-brand" onClick={() => setOpen(false)} aria-label="Право на решение — главная" aria-current={pathname === "/" ? "page" : undefined}>
            <svg width="24" height="24" viewBox="0 0 25 25" fill="none" aria-hidden="true">
              <path d="M4 21V4h8a8 8 0 0 1 0 16M4 12h16M12 4v17" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="20" cy="12" r="3" fill="currentColor" />
            </svg>
            <span>право на решение</span>
          </Link>
          <button ref={toggle} type="button" className="v101-menu-toggle" aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open} aria-controls="book-navigation" onClick={() => setOpen(!open)}>
            <span>Меню</span>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d={open ? "M5 5l10 10M15 5L5 15" : "M3 6h14M3 14h14"} stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <div id="book-navigation" className="v101-nav-links" data-open={open}>
            {links.map(({ href, label }) => {
              const current = pathname === href.slice(0, -1) || pathname.startsWith(href);
              return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={current ? "page" : undefined}>{label}</Link>;
            })}
          </div>
        </nav>
      </header>
    </>
  );
}
