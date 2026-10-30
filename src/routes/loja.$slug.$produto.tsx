import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { GradeProdutos } from "@/components/loja/GradeProdutos";
import { SemFoto } from "@/components/loja/icones";
import { descricaoDoProduto, lojaDosMatches, metaDaLoja } from "@/components/loja/leituraLoja";
import { useLojaVitrine } from "@/components/loja/LojaContexto";
import { BeneficiosLoja } from "@/components/loja/SelosLoja";
import { reais, type ProdutoLoja } from "@/lib/loja";
import { sinalDoPreco } from "@/lib/lojaVitrine";
import { linkCanonico } from "@/lib/seo";

// Página de um produto da loja (/loja/<endereço>/<id do produto>): galeria,
// preço com o sinal, escolha da variação (obrigatória quando existe),
// "Adicionar ao carrinho", benefícios e "Combine com". A loja vem do layout
// loja.$slug.tsx; o id que não existe mostra um aviso com volta pra vitrine.

export const Route = createFileRoute("/loja/$slug/$produto")({
  head: ({ matches, params }) => {
    const loja = lojaDosMatches(matches);
    const p = loja?.produtos.find((x) => x.id === params.produto);
    if (!loja || !p) return { meta: [{ title: loja ? `Produto não encontrado · ${loja.nome}` : "Loja" }] };
    return {
      meta: metaDaLoja({
        titulo: `${p.nome} · ${loja.nome}`,
        descricao: descricaoDoProduto(p.nome, p.descricao, p.preco),
        imagem: p.fotos[0] ?? loja.logoUrl,
        caminho: `/loja/${loja.slug}/${p.id}`,
        indexar: true,
        marca: loja.nome,
      }),
      links: [linkCanonico(`/loja/${loja.slug}/${p.id}`)],
    };
  },
  component: ProdutoPage,
});

function ProdutoPage() {
  const { produto: id } = Route.useParams();
  const { loja } = useLojaVitrine();
  const produto = loja.produtos.find((p) => p.id === id);
  if (!produto) return <ProdutoNaoEncontrado slug={loja.slug} />;
  // key: trocar de produto pelo "Combine com" zera foto e escolha.
  return <PaginaDoProduto key={produto.id} produto={produto} />;
}

function ProdutoNaoEncontrado({ slug }: { slug: string }) {
  return (
    <div className="estado" role="alert">
      <h1>Esse produto não está na loja</h1>
      <p>Ele pode ter saído da vitrine, ou o link veio cortado.</p>
      <Link to="/loja/$slug" params={{ slug }} hash="produtos" className="btn sec">
        Ver todos os produtos
      </Link>
    </div>
  );
}

function PaginaDoProduto({ produto: p }: { produto: ProdutoLoja }) {
  const { loja, adicionar } = useLojaVitrine();
  const [foto, setFoto] = useState(0);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [faltaEscolher, setFaltaEscolher] = useState(false);
  const [barra, setBarra] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const escolhaRef = useRef<HTMLFieldSetElement>(null);
  const uid = useId();
  const temVariacao = p.variacoes.length > 0;
  const variacao = p.variacoes.find((v) => v.id === escolha) ?? null;
  const sinal = sinalDoPreco(p.preco, loja.sinalPercentual);
  const outros = loja.produtos.filter((x) => x.id !== p.id).slice(0, 4);

  // Barra fixa de compra no celular: aparece quando o botão principal sai
  // da tela por cima (a cliente rolou pra baixo).
  useEffect(() => {
    const alvo = botaoRef.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([x]) => setBarra(!x.isIntersecting && x.boundingClientRect.top < 0));
    io.observe(alvo);
    return () => io.disconnect();
  }, []);

  const porNoCarrinho = () => {
    if (temVariacao && !variacao) {
      setFaltaEscolher(true);
      const grupo = escolhaRef.current;
      grupo?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      grupo?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      return;
    }
    adicionar(p, variacao);
  };

  const fotoAtual = p.fotos[foto] ?? p.fotos[0];

  return (
    <>
      <div className="wrap">
        <nav className="migalhas" aria-label="Você está em">
          <Link to="/loja/$slug" params={{ slug: loja.slug }}>
            Início
          </Link>
          {" / "}
          <Link to="/loja/$slug" params={{ slug: loja.slug }} hash="produtos">
            Produtos
          </Link>
          {" / "}
          <span aria-current="page">{p.nome}</span>
        </nav>

        <div className="produto">
          <div className={`galeria${p.fotos.length > 1 ? " com-miniaturas" : ""}`}>
            <div className="principal">
              {fotoAtual ? <img src={fotoAtual} alt={`${p.nome}, foto ${foto + 1}`} fetchPriority="high" /> : <SemFoto />}
            </div>
            {p.fotos.length > 1 && (
              <div className="miniaturas" role="group" aria-label="Fotos do produto">
                {p.fotos.map((f, i) => (
                  <button
                    key={f}
                    type="button"
                    className="miniatura"
                    aria-pressed={i === foto}
                    aria-label={`Ver a foto ${i + 1} de ${p.fotos.length}`}
                    onClick={() => setFoto(i)}
                  >
                    <img src={f} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="compra">
            <span className="olho">{loja.nome}</span>
            <h1>{p.nome}</h1>
            <div className="preco-linha">
              <span className="preco-g">{reais(p.preco)}</span>
              {sinal > 0 && <span className="sinal-tag">Comece com {reais(sinal)} de sinal</span>}
            </div>
            {p.descricao && <p className="desc">{p.descricao}</p>}

            {temVariacao && (
              <fieldset
                ref={escolhaRef}
                className={`escolha${faltaEscolher && !variacao ? " com-erro" : ""}`}
                aria-describedby={faltaEscolher && !variacao ? `${uid}-erro` : undefined}
              >
                <legend>Escolha a opção</legend>
                <p className="escolhida" aria-live="polite">
                  {variacao ? variacao.nome : "Nenhuma escolhida ainda"}
                </p>
                <div className="chips">
                  {p.variacoes.map((v) => (
                    <label key={v.id} className="chip">
                      <input
                        type="radio"
                        name={`${uid}-variacao`}
                        value={v.id}
                        checked={escolha === v.id}
                        onChange={() => {
                          setEscolha(v.id);
                          setFaltaEscolher(false);
                        }}
                      />
                      {v.nome}
                    </label>
                  ))}
                </div>
                {faltaEscolher && !variacao && (
                  <p id={`${uid}-erro`} className="erro">
                    Escolha uma opção antes de pôr no carrinho.
                  </p>
                )}
              </fieldset>
            )}

            <div className="comprar">
              <button ref={botaoRef} type="button" className="btn largo" onClick={porNoCarrinho}>
                <ShoppingBag aria-hidden="true" strokeWidth={1.7} />
                <span>Adicionar ao carrinho</span>
              </button>
            </div>
            <BeneficiosLoja loja={loja} />
          </div>
        </div>

        {outros.length > 0 && (
          <section className="secao" aria-labelledby={`${uid}-combine`}>
            <div className="secao-topo">
              <div>
                <span className="olho">Da mesma loja</span>
                <h2 id={`${uid}-combine`}>Combine com</h2>
              </div>
            </div>
            <GradeProdutos slug={loja.slug} produtos={outros} />
          </section>
        )}
      </div>

      <div className={`barra-produto${barra ? " on" : ""}`}>
        <div className="nome">
          <b>{p.nome}</b>
          {variacao ? `${variacao.nome} · ${reais(p.preco)}` : reais(p.preco)}
        </div>
        <button type="button" className="btn" onClick={porNoCarrinho} tabIndex={barra ? 0 : -1}>
          <ShoppingBag aria-hidden="true" strokeWidth={1.7} />
          <span>Adicionar</span>
        </button>
      </div>
    </>
  );
}
