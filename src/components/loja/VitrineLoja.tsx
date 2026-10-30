import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { reais, type LojaPublica } from "@/lib/loja";
import { coresDaVitrine } from "@/lib/lojaVitrine";
import { CarrinhoDialog } from "./CarrinhoDialog";
import { LojaVitrineProvider, useLojaVitrine } from "./LojaContexto";

// Casca visual da loja pública: topo com a sacola, rodapé, barra do
// carrinho, aviso e a janela do carrinho. A marca é da CLIENTE (cor dela
// inline no elemento raiz); a Pólia aparece só no rodapé. Estilos em
// vitrine.css, todos presos em .loja-vitrine.

/** Variáveis de cor da marca da cliente, com contraste já ajustado. */
export function estiloDaMarca(cor: string | null): CSSProperties {
  const c = coresDaVitrine(cor);
  return {
    "--destaque": c.destaque,
    "--destaque-texto": c.destaqueTexto,
    "--destaque-sobre": c.destaqueSobre,
    "--destaque-claro": c.destaqueClaro,
  } as CSSProperties;
}

/** Raiz sem loja carregada (loja fechada, erro de rede): mesmo visual, cor padrão. */
export function VitrineSimples({ children }: { children: ReactNode }) {
  return (
    <div className="loja-vitrine" style={estiloDaMarca(null)}>
      <main id="conteudo">{children}</main>
    </div>
  );
}

export function VitrineLoja({ loja, children }: { loja: LojaPublica; children: ReactNode }) {
  return (
    <LojaVitrineProvider loja={loja}>
      <Casca>{children}</Casca>
    </LojaVitrineProvider>
  );
}

function Casca({ children }: { children: ReactNode }) {
  const { loja, resumo, abrirCarrinho, aviso } = useLojaVitrine();
  const estilo = useMemo(() => estiloDaMarca(loja.cor), [loja.cor]);
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const marcar = () => setRolou(window.scrollY > 8);
    marcar();
    window.addEventListener("scroll", marcar, { passive: true });
    return () => window.removeEventListener("scroll", marcar);
  }, []);

  const n = resumo.quantidade;
  const pecas = `${n} ${n === 1 ? "item" : "itens"}`;

  return (
    <div className={`loja-vitrine${n > 0 ? " tem-carrinho" : ""}`} style={estilo}>
      <a href="#conteudo" className="pular">
        Pular para o conteúdo
      </a>
      {loja.aviso && <p className="aviso-loja">{loja.aviso}</p>}
      <header className={`topo-site${rolou ? " rolou" : ""}`}>
        <div className="wrap">
          <Link to="/loja/$slug" params={{ slug: loja.slug }} className="marca" aria-label={`${loja.nome}, página inicial`}>
            {loja.logoUrl ? <img src={loja.logoUrl} alt={loja.nome} /> : <span className="titulo">{loja.nome}</span>}
          </Link>
          <nav className="menu" aria-label="Seções da loja">
            <Link to="/loja/$slug" params={{ slug: loja.slug }} hash="produtos">
              Produtos
            </Link>
            <Link to="/loja/$slug" params={{ slug: loja.slug }} hash="como">
              Como encomendar
            </Link>
          </nav>
          <button
            type="button"
            className="sacola"
            onClick={abrirCarrinho}
            aria-label={n > 0 ? `Abrir o carrinho, ${pecas}` : "Abrir o carrinho"}
          >
            <ShoppingBag aria-hidden="true" strokeWidth={1.7} />
            {n > 0 && (
              <span className="contador" aria-hidden="true">
                {n}
              </span>
            )}
          </button>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="rodape">
        <span>
          {loja.nome}
          {loja.instagram && (
            <>
              {" · "}
              <a href={`https://www.instagram.com/${encodeURIComponent(loja.instagram)}/`} target="_blank" rel="noopener">
                @{loja.instagram}
              </a>
            </>
          )}
        </span>
        <span className="feita">
          Loja feita na{" "}
          <a href="https://one.usepolia.com.br/?utm_source=loja&utm_medium=rodape" target="_blank" rel="noopener">
            Pólia One
          </a>
        </span>
      </footer>

      {n > 0 && (
        <button type="button" className="barra-carrinho" onClick={abrirCarrinho}>
          <span>{pecas}</span>
          <span>{reais(resumo.subtotal)} · Ver carrinho</span>
        </button>
      )}
      <div className={`aviso-toast${aviso ? " on" : ""}`} role="status" aria-live="polite">
        {aviso}
      </div>
      <CarrinhoDialog />
    </div>
  );
}
