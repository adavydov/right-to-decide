"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./BookHeader.module.css";
export function BookHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const links = [
    { href: "/", label: "О книге" },
    { href: "/contents/", label: "Содержание" },
    { href: "/authors/", label: "Авторы" },
    { href: "/library/", label: "Библиотека" },
    { href: "/wiki/", label: "Вики" },
  ];
  return (
    <>
      <a href="#main-content" className="skip-link">
        К содержимому
      </a>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Основная навигация">
          <Link
            href="/"
            className={styles.brand}
            onClick={() => setOpen(false)}
            aria-label="Право на решение — главная"
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 25 25"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 21V4h8a8 8 0 0 1 0 16M4 12h16M12 4v17"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="20" cy="12" r="3" fill="currentColor" />
            </svg>
            <span>право на решение</span>
          </Link>
          <div id="book-navigation" className={styles.links} data-open={open}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={
                  pathname === l.href || pathname === l.href.slice(0, -1)
                    ? "page"
                    : undefined
                }
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link
            href="/read/"
            className={styles.read}
            onClick={() => setOpen(false)}
          >
            Читать книгу <span aria-hidden="true">↗</span>
          </Link>
          <button
            className={styles.toggle}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            aria-controls="book-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? "✕" : "☰"}
          </button>
        </nav>
      </header>
    </>
  );
}
