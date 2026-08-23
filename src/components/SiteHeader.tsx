"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./SiteHeader.module.css";

const desktopLinks = [
  { href: "#problem", label: "Проблема" },
  { href: "#theses", label: "Тезисы" },
  { href: "#contents", label: "Содержание" },
] as const;

const menuLinks = [
  { href: "#problem", label: "Проблема" },
  { href: "#theses", label: "Тезисы" },
  { href: "#framework", label: "Формула" },
  { href: "#contents", label: "Содержание" },
  { href: "#world", label: "Мировой опыт" },
  { href: "#novelty", label: "Научная новизна" },
  { href: "#sources", label: "Источники" },
  { href: "#author", label: "Об авторе" },
  {
    href: "https://github.com/adavydov/right-to-decide",
    label: "Репозиторий",
    external: true,
  },
] as const;

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !headerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Перейти к содержанию
      </a>
      <header className={styles.header} ref={headerRef}>
        <div className={styles.inner}>
          <a className={styles.brand} href="#" onClick={closeMenu}>
            Право на решение
          </a>

          <nav className={styles.desktopNav} aria-label="Основные разделы">
            {desktopLinks.map((link) => (
              <a href={link.href} key={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className={styles.menuArea}>
            <button
              ref={triggerRef}
              className={`${styles.menuTrigger} ${isOpen ? styles.menuTriggerOpen : ""}`}
              type="button"
              aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={isOpen}
              aria-controls={dropdownId}
              onClick={() => setIsOpen((current) => !current)}
            >
              <span className={styles.menuGlyph} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            <nav
              className={`${styles.dropdown} ${isOpen ? styles.dropdownOpen : ""}`}
              id={dropdownId}
              aria-label="Все разделы"
              aria-hidden={!isOpen}
            >
              {menuLinks.map((link) => (
                <a
                  href={link.href}
                  key={link.href}
                  onClick={closeMenu}
                  {...("external" in link && link.external
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                >
                  {link.label}
                  {"external" in link && link.external ? (
                    <span aria-hidden="true"> ↗</span>
                  ) : null}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}

export default SiteHeader;
