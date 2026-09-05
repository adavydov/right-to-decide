"use client";

import { useRef } from "react";
import type { ReaderFont } from "@/lib/reader";
import { readerFontOrder, readerFonts, readerFontSample } from "@/lib/reader-fonts";
import styles from "./ReaderFontPicker.module.css";

type ReaderFontPickerProps = {
  value: ReaderFont;
  onChange: (font: ReaderFont) => void;
};

export default function ReaderFontPicker({ value, onChange }: ReaderFontPickerProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const selectedFont = readerFonts[value];

  function chooseFont(font: ReaderFont) {
    onChange(font);
    if (details.current) details.current.open = false;
    summary.current?.focus();
  }

  return (
    <div className={styles.root}>
      <details ref={details} className={styles.picker}>
        <summary ref={summary} className={styles.summary} data-reader-font-picker-summary aria-label={`Выбрать шрифт: ${selectedFont.name}`}>
          <span>{selectedFont.name}</span>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className={styles.choices}>
          {readerFontOrder.map((font) => {
            const option = readerFonts[font];
            const selected = value === font;
            return (
              <button
                key={font}
                type="button"
                className={styles.choice}
                data-reader-font-choice={font}
                aria-label={option.name}
                aria-pressed={selected}
                onClick={() => chooseFont(font)}
              >
                <span className={styles.choiceHeading}>
                  <span className={styles.name}>{option.name}</span>
                  {selected && <span className={styles.check} aria-hidden="true">✓</span>}
                </span>
                <span className={styles.description}>{option.description}</span>
                <span className={styles.sample} data-reader-font-sample style={{ fontFamily: option.family, fontOpticalSizing: "auto" }}>
                  {readerFontSample}
                </span>
              </button>
            );
          })}
        </div>
      </details>
      <p className={`${styles.sample} ${styles.selectedPreview}`} style={{ fontFamily: selectedFont.family, fontOpticalSizing: "auto" }}>
        {readerFontSample}
      </p>
    </div>
  );
}
