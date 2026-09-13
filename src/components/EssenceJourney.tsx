"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

export interface TextRun {
  text: string;
  strong?: boolean;
  emphasis?: boolean;
  href?: string;
  noteId?: string;
}

export interface EssenceData {
  schemaVersion: number;
  editionVersion: string;
  contentRevision?: string;
  bookTitle?: string;
  literaryLabel?: string;
  title: string;
  subtitle: string;
  intro: string;
  epigraph?: { text: string; attribution: string };
  notes?: { id: string; number: number; runs: TextRun[]; text: string }[];
  readingMinutes: { min: number; max: number; basis: string };
  parts: { id: string; title: string }[];
  steps: {
    id: string;
    part: string;
    chapterId: string;
    title: string;
    insight?: string;
    paragraphs: string[];
    paragraphRuns?: TextRun[][];
    fork?: { question: string; options: { title: string; outcome: string }[] };
  }[];
}

function externalHref(href?: string) {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}

function InlineText({ runs, referenceIds }: { runs: TextRun[]; referenceIds?: (string | undefined)[] }) {
  return runs.map((run, index) => {
    let content: ReactNode = run.text;
    if (run.emphasis) content = <em>{content}</em>;
    if (run.strong) content = <strong>{content}</strong>;
    if (run.noteId) {
      return <sup className="essence-note-reference" key={index}>
        <a id={referenceIds?.[index]} href={"#" + run.noteId} role="doc-noteref" aria-label={"Примечание " + run.text}>{content}</a>
      </sup>;
    }
    const href = externalHref(run.href);
    return href ? <a key={index} href={href}>{content}</a> : <span key={index}>{content}</span>;
  });
}

function chapterHref(id: string) {
  if (id === "P00") return "/read/prologue/";
  if (id === "E00") return "/read/epilogue/";
  return "/read/chapter-" + id.slice(1).toLowerCase() + "/";
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readStorage(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

const serverSnapshot = () => null;

export function EssenceJourney({ data }: { data: EssenceData }) {
  const journey = useRef<HTMLElement>(null);
  const progressBar = useRef<HTMLDivElement>(null);
  const contents = useRef<HTMLDetailsElement>(null);
  const [currentId, setCurrentId] = useState(data.steps[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, number | undefined>>({});
  const contentRevision = data.contentRevision ?? "1";
  const storageKey = "right-to-decide:essence-progress:v2:" + data.editionVersion + ":revision:" + contentRevision;
  const stepIds = useMemo(() => new Set(data.steps.map(step => step.id)), [data.steps]);
  const richParagraphs = useMemo(() => {
    const referenceCounts = new Map<string, number>();
    return new Map(data.steps.map(step => [step.id, step.paragraphRuns?.map(runs => ({
      runs,
      referenceIds: runs.map(run => {
        if (!run.noteId) return undefined;
        const count = (referenceCounts.get(run.noteId) ?? 0) + 1;
        referenceCounts.set(run.noteId, count);
        return "essence-ref-" + run.noteId + (count > 1 ? "-" + count : "");
      }),
    }))]));
  }, [data.steps]);
  const getSnapshot = useCallback(() => readStorage(storageKey), [storageKey]);
  const stored = useSyncExternalStore(subscribeToStorage, getSnapshot, serverSnapshot);
  const savedId = useMemo(() => {
    try {
      const saved = stored ? JSON.parse(stored) : null;
      return saved?.editionVersion === data.editionVersion && saved?.contentRevision === contentRevision && stepIds.has(saved.lastStep) ? saved.lastStep as string : null;
    } catch { return null; }
  }, [stored, data.editionVersion, contentRevision, stepIds]);
  const currentIndex = Math.max(0, data.steps.findIndex(step => step.id === currentId));
  const current = data.steps[currentIndex];
  const currentPart = data.parts.find(part => part.id === current?.part);
  const completeJourney = data.steps.length === 28 && data.steps.some(step => step.chapterId === "E00");

  const saveProgress = useCallback((id: string) => {
    if (!stepIds.has(id)) return;
    try {
      const prior = readStorage(storageKey);
      // Earlier editions and literary revisions keep their own saved positions.
      if (prior) {
        const saved = JSON.parse(prior);
        if (saved?.editionVersion !== data.editionVersion || saved?.contentRevision !== contentRevision) return;
      }
      window.localStorage.setItem(storageKey, JSON.stringify({ editionVersion: data.editionVersion, contentRevision, lastStep: id }));
    } catch { /* Reading works when storage is unavailable or contains invalid data. */ }
  }, [data.editionVersion, contentRevision, stepIds, storageKey]);

  useEffect(() => {
    const root = journey.current;
    const bar = progressBar.current;
    if (!root || !bar || !("IntersectionObserver" in window)) return;
    let observer: IntersectionObserver;
    let frame = 0;
    let activeId = "";
    let readingTop = 0;
    const visible = new Set<Element>();
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-essence-step]"));
    const updatePosition = () => {
      frame = 0;
      // A short tail of the previous step must not outweigh the step being read.
      const active = sections.filter(section => visible.has(section)).map(section => {
        const bounds = section.getBoundingClientRect();
        return { section, height: Math.max(0, Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, readingTop)) };
      }).sort((a, b) => b.height - a.height)[0]?.section;
      const id = active?.dataset.essenceStep;
      if (!id || id === activeId) return;
      activeId = id;
      setCurrentId(id);
      if (window.scrollY > 0 || window.location.hash === "#step-" + id) saveProgress(id);
    };
    const schedulePosition = () => { if (!frame) frame = window.requestAnimationFrame(updatePosition); };
    const install = () => {
      observer?.disconnect();
      visible.clear();
      const height = bar.getBoundingClientRect().height;
      root.style.setProperty("--essence-progress-height", height + "px");
      const navHeight = parseFloat(getComputedStyle(root).getPropertyValue("--essence-nav-height")) || 88;
      readingTop = Math.min(navHeight + height + 16, Math.max(0, window.innerHeight - 48));
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        schedulePosition();
      }, { rootMargin: `-${readingTop}px 0px 0px 0px`, threshold: 0 });
      sections.forEach(section => observer.observe(section));
    };
    install();
    const resize = new ResizeObserver(install);
    resize.observe(bar);
    window.addEventListener("resize", install);
    window.addEventListener("scroll", schedulePosition, { passive: true });
    return () => {
      observer.disconnect(); resize.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", install);
      window.removeEventListener("scroll", schedulePosition);
    };
  }, [data.steps, saveProgress]);

  const goToStep = (id: string) => {
    setCurrentId(id);
    saveProgress(id);
    if (contents.current) contents.current.open = false;
  };

  return (
    <main id="main-content" className="essence-journey" ref={journey}>
      <header className="essence-introduction essence-container">
        <p className="essence-eyebrow">{data.bookTitle && <>{data.bookTitle} · </>}Весь путь, включая финал</p>
        <h1>{data.title}</h1>
        {data.literaryLabel && <p className="essence-literary-label"><em>{data.literaryLabel}</em></p>}
        <p className="essence-subtitle">{data.subtitle}</p>
        <p className="essence-intro-copy">{data.intro}</p>
        {data.epigraph && <figure className="essence-epigraph">
          <blockquote><p>{data.epigraph.text}</p></blockquote>
          <figcaption>{data.epigraph.attribution}</figcaption>
        </figure>}
        <div className="essence-entry-actions">
          {data.steps[0] && <a className="essence-start" href={"#step-" + data.steps[0].id} onClick={() => goToStep(data.steps[0].id)}>Начать <span aria-hidden="true">↓</span></a>}
          {savedId && savedId !== data.steps[0]?.id && <a className="essence-resume" href={"#step-" + savedId} onClick={() => goToStep(savedId)}>Продолжить со шага {data.steps.findIndex(step => step.id === savedId) + 1} <span aria-hidden="true">↗</span></a>}
        </div>
        <p className="essence-length">{completeJourney && <>{data.readingMinutes.min}–{data.readingMinutes.max} минут · </>}{data.steps.length} шагов</p>
        <details className="essence-contents" id="essence-contents" ref={contents}>
          <summary>Оглавление <span aria-hidden="true">+</span></summary>
          <nav aria-label="Шаги «Сути»">
            {data.parts.map(part => {
              const steps = data.steps.filter(step => step.part === part.id);
              if (!steps.length) return null;
              return <div className="essence-contents-part" key={part.id}>
                <p>{part.title}</p>
                <ol>{steps.map(step => <li key={step.id}><a href={"#step-" + step.id} onClick={() => goToStep(step.id)}><span>{step.id}</span>{step.title}</a></li>)}</ol>
              </div>;
            })}
            {!!data.notes?.length && <a className="essence-contents-notes" href="#essence-notes" onClick={() => { if (contents.current) contents.current.open = false; }}>Примечания <span aria-hidden="true">↓</span></a>}
          </nav>
        </details>
      </header>

      {current && <div className="essence-progress" ref={progressBar}>
        <div className="essence-container essence-progress-row">
          <p className="essence-position">Шаг {currentIndex + 1} из {data.steps.length}</p>
          <p className="essence-current-part">{currentPart?.title}</p>
          <a href="#essence-contents" onClick={() => { if (contents.current) contents.current.open = true; }}>Оглавление <span aria-hidden="true">↑</span></a>
        </div>
        <progress value={currentIndex + 1} max={data.steps.length} aria-label="Положение в тексте" />
      </div>}

      {data.steps.map((step, index) => {
        const part = data.parts.find(item => item.id === step.part);
        const partBoundary = index > 0 && data.steps[index - 1].part !== step.part;
        const next = data.steps[index + 1];
        return <section key={step.id} id={"step-" + step.id} data-essence-step={step.id} className={"essence-step" + (partBoundary ? " essence-part-opening" : "")} aria-labelledby={"step-title-" + step.id}>
          <div className="essence-container essence-step-grid">
            <div className="essence-step-heading">
              <p className="essence-eyebrow"><span>{step.id}</span> / {part?.title}</p>
              <h2 id={"step-title-" + step.id}>{step.title}</h2>
              {step.insight && <p className="essence-insight">{step.insight}</p>}
            </div>
            <div className="essence-step-body">
              <div className="essence-paragraphs">{step.paragraphs.map((paragraph, paragraphIndex) => {
                const rich = richParagraphs.get(step.id)?.[paragraphIndex];
                return <p key={paragraphIndex} id={`essence-${step.id}-p${paragraphIndex + 1}`} data-essence-text="paragraph">{rich ? <InlineText runs={rich.runs} referenceIds={rich.referenceIds} /> : paragraph}</p>;
              })}</div>
              {step.fork && <div className="essence-fork" aria-labelledby={"fork-" + step.id}>
                <h3 id={"fork-" + step.id}>{step.fork.question}</h3>
                <ul>{step.fork.options.map((option, optionIndex) => <li key={option.title}>
                  <button type="button" aria-pressed={choices[step.id] === optionIndex} onClick={() => setChoices(previous => ({ ...previous, [step.id]: previous[step.id] === optionIndex ? undefined : optionIndex }))}>
                    <span className="essence-option-title">{option.title}</span>
                    <span className="essence-option-outcome">{option.outcome}</span>
                  </button>
                </li>)}</ul>
              </div>}
              <footer className="essence-step-footer">
                <Link href={chapterHref(step.chapterId)}>В книге <span aria-hidden="true">↗</span></Link>
                {next ? <a href={"#step-" + next.id} onClick={() => goToStep(next.id)}>Дальше <span aria-hidden="true">↓</span></a> : <a href="#main-content">К началу <span aria-hidden="true">↑</span></a>}
              </footer>
            </div>
          </div>
        </section>;
      })}
      {!!data.notes?.length && <section id="essence-notes" className="essence-notes" role="doc-endnotes" aria-labelledby="essence-notes-title">
        <div className="essence-container essence-step-grid">
          <div className="essence-step-heading"><h2 id="essence-notes-title">Примечания</h2></div>
          <div className="essence-step-body">
            <ol>{data.notes.map(note => <li key={note.id} id={note.id} value={note.number}>
              <p><span id={note.id + "-text"} data-essence-text="note"><InlineText runs={note.runs} /></span> <a className="essence-note-backlink" href={"#essence-ref-" + note.id} role="doc-backlink" aria-label={"Вернуться к примечанию " + note.number + " в тексте"}>К тексту <span aria-hidden="true">↑</span></a></p>
            </li>)}</ol>
            <footer className="essence-step-footer"><a href="#main-content">К началу <span aria-hidden="true">↑</span></a></footer>
          </div>
        </div>
      </section>}
    </main>
  );
}
