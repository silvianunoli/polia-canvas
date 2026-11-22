import { useEffect, useState } from "react";

// Banner rotativo do topo da vitrine (22/11/2026). A dona sobe até 5 imagens
// em /catalogo; aqui elas passam sozinhas a cada 5 s. Para no mouse, no foco
// do teclado e com "reduzir movimento" ligado no aparelho (aí só troca pelos
// pontinhos ou pelas setas). Com uma imagem só, vira banner fixo.

const INTERVALO_MS = 5000;

export function BannerLoja({ banners, nome }: { banners: string[]; nome: string }) {
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [semMovimento, setSemMovimento] = useState(false);
  const total = banners.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSemMovimento(mq.matches);
    const mudou = (e: MediaQueryListEvent) => setSemMovimento(e.matches);
    mq.addEventListener("change", mudou);
    return () => mq.removeEventListener("change", mudou);
  }, []);

  useEffect(() => {
    if (total < 2 || pausado || semMovimento) return;
    const t = window.setInterval(() => setAtual((i) => (i + 1) % total), INTERVALO_MS);
    return () => window.clearInterval(t);
  }, [total, pausado, semMovimento]);

  if (!total) return null;
  const ir = (i: number) => setAtual(((i % total) + total) % total);

  return (
    <section
      className="wrap banner-loja"
      aria-roledescription="carrossel"
      aria-label={`Destaques da ${nome}`}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="banner-trilho">
        {banners.map((url, i) => (
          <div
            key={url}
            className={`banner-slide${i === atual ? " ativo" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}`}
            aria-hidden={i !== atual}
          >
            <img src={url} alt="" fetchPriority={i === 0 ? "high" : undefined} loading={i === 0 ? "eager" : "lazy"} />
          </div>
        ))}
        {total > 1 && (
          <>
            <button type="button" className="banner-seta ant" onClick={() => ir(atual - 1)} aria-label="Destaque anterior">
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" className="banner-seta prox" onClick={() => ir(atual + 1)} aria-label="Próximo destaque">
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="banner-pontos">
          {banners.map((url, i) => (
            <button
              key={url}
              type="button"
              className={i === atual ? "ativo" : undefined}
              onClick={() => ir(i)}
              aria-label={`Ver o destaque ${i + 1}`}
              aria-current={i === atual ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
