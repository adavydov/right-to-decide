import Image from "next/image";
import Link from "next/link";
import { assetPath } from "@/lib/site-config";

export function HomeHeroV101() {
  return (
    <section className="v101-hero" aria-labelledby="publication-title">
      <div className="v101-hero-inner">
        <div className="v101-hero-copy">
          <h1 id="publication-title" className="v101-hero-title">Право<br />на решение</h1>
          <p className="v101-hero-subtitle">Чего мы захотим, когда получим всё</p>
          <p className="v101-hero-lead">Как полезные решения меняют власть, наши желания и того, кто выбирает следующий шаг</p>
          <p className="v101-hero-authors">
            <span>А. М. Давыдов</span><span aria-hidden="true"> · </span>
            <span>А. А. Давыдов</span><span aria-hidden="true"> · </span>
            <span>Е. А. Давыдов</span>
          </p>
          <div className="v101-hero-actions">
            <Link href="/essence/" className="v101-primary-link" aria-describedby="essence-reading-time">Понять суть <span aria-hidden="true">↗</span></Link>
            <Link href="/read/prologue/" className="v101-secondary-link">Читать книгу <span aria-hidden="true">↗</span></Link>
          </div>
          <p id="essence-reading-time" className="v101-hero-meta">30–40 минут · весь путь, включая финал</p>
        </div>
      </div>
      <figure className="v101-hero-art">
        <Image src={assetPath("/images/right-to-decide-hero-v10-1.png")} alt="Человеческий город и выросшая из него исследовательская техносфера" width={1536} height={1024} sizes="100vw" priority />
      </figure>
    </section>
  );
}
