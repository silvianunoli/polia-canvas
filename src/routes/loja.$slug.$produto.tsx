import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { GradeProdutos } from "@/components/loja/GradeProdutos";
import { IconeWhatsapp, SemFoto } from "@/components/loja/icones";
import {
  descricaoDoProduto,
  lojaDosMatches,
  metaDaLoja,
  type LeituraLoja,
} from "@/components/loja/leituraLoja";
import { useLojaVitrine } from "@/components/loja/LojaContexto";
import { BeneficiosLoja } from "@/components/loja/SelosLoja";
import {
  OPCAO_COR_DA_FOTO,
  descontoDoDePor,
  opcaoDasCores,
  reais,
  type ProdutoLoja,
} from "@/lib/loja";
import { linkWhatsapp, sinalDoPreco } from "@/lib/lojaVitrine";
import { urlPublicaDaLoja } from "@/lib/lojaDoDominio";

// Página de um produto da loja (/loja/<endereço>/<id do produto>): galeria,
// preço com o sinal, escolha da variação (obrigatória quando existe),
// "Adicionar ao carrinho", benefícios e "Combine com". A loja vem do layout
// loja.$slug.tsx; o id que não existe mostra um aviso com volta pra vitrine.

export const Route = createFileRoute("/loja/$slug/$produto")({
  // A loja já vem do layout; repetir aqui faz o head() do servidor enxergá-la.
  // Sem isto, o HTML do produto saía com o título "Loja" e a prévia da loja
  // inteira (os matches do head no servidor ainda não tinham o loaderData).
  loader: async ({ parentMatchPromise }) =>
    (await parentMatchPromise).loaderData as LeituraLoja | undefined,
  head: ({ matches, params, loaderData }) => {
    const loja = loaderData?.ok ? loaderData.loja : lojaDosMatches(matches);
    const p = loja?.produtos.find((x) => x.id === params.produto);
    if (!loja || !p)
      return { meta: [{ title: loja ? `Produto não encontrado · ${loja.nome}` : "Loja" }] };
    return {
      meta: metaDaLoja({
        titulo: `${p.nome} · ${loja.nome}`,
        descricao: descricaoDoProduto(p.nome, p.descricao, p.precoSobConsulta ? null : p.preco),
        imagem: p.fotos[0] ?? loja.logoUrl,
        caminho: `/loja/${loja.slug}/${p.id}`,
        indexar: true,
        marca: loja.nome,
      }),
      links: [{ rel: "canonical", href: urlPublicaDaLoja(`/loja/${loja.slug}/${p.id}`) }],
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
  // Produto com paleta começa na "Cor da foto", como na Loveless.
  const [escolha, setEscolha] = useState<string | null>(p.usaPaleta ? OPCAO_COR_DA_FOTO : null);
  // Produto que deixa misturar cores (max_cores 2 ou 3): as cores marcadas, na
  // ordem do toque. "Cor da foto" e as cores não se misturam.
  const variasCores = p.usaPaleta && p.maxCores > 1;
  const [cores, setCores] = useState<string[]>([]);
  const [faltaEscolher, setFaltaEscolher] = useState(false);
  const [barra, setBarra] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const escolhaRef = useRef<HTMLFieldSetElement>(null);
  const uid = useId();
  const temVariacao = p.variacoes.length > 0;
  const variacao =
    variasCores && cores.length
      ? opcaoDasCores(p, cores)
      : (p.variacoes.find((v) => v.id === escolha) ?? null);
  const noLimite = variasCores && cores.length >= p.maxCores;
  const marcarCor = (id: string) => {
    setFaltaEscolher(false);
    setEscolha(null);
    setCores((atuais) =>
      atuais.includes(id)
        ? atuais.filter((x) => x !== id)
        : atuais.length < p.maxCores
          ? [...atuais, id]
          : atuais,
    );
  };
  const sinal = sinalDoPreco(p.preco, loja.sinalPercentual);
  // Preço de-por (ONE-239): riscado e com selo só quando o "antes" é maior.
  const desconto = p.precoSobConsulta ? null : descontoDoDePor(p.precoDe, p.preco);
  const outros = loja.produtos.filter((x) => x.id !== p.id).slice(0, 4);

  // Barra fixa de compra no celular: aparece quando o botão principal sai
  // da tela por cima (a cliente rolou pra baixo).
  useEffect(() => {
    const alvo = botaoRef.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([x]) =>
      setBarra(!x.isIntersecting && x.boundingClientRect.top < 0),
    );
    io.observe(alvo);
    return () => io.disconnect();
  }, []);

  // Preço sob consulta: no lugar do carrinho, um botão pro WhatsApp da loja.
  const consulta = p.precoSobConsulta
    ? linkWhatsapp(
        loja.whatsapp,
        `Oi, ${loja.nome}. Vi ${p.nome} na loja online e queria saber o preço.`,
      )
    : null;

  const porNoCarrinho = () => {
    if (p.esgotado || p.precoSobConsulta) return;
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
              {fotoAtual ? (
                <img src={fotoAtual} alt={`${p.nome}, foto ${foto + 1}`} fetchPriority="high" />
              ) : (
                <SemFoto />
              )}
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
              {p.precoSobConsulta ? (
                <span className="preco-g consulta">Preço sob consulta</span>
              ) : (
                <>
                  {desconto && p.precoDe && (
                    <s className="preco-de">
                      <span className="sr-only">De </span>
                      {reais(p.precoDe)}
                    </s>
                  )}
                  <span className="preco-g">
                    {desconto && <span className="sr-only">por </span>}
                    {reais(p.preco)}
                  </span>
                  {desconto && <span className="selo-desconto em-linha">-{desconto}%</span>}
                </>
              )}
              {sinal > 0 && !p.precoSobConsulta && (
                <span className="sinal-tag">Comece com {reais(sinal)} de sinal</span>
              )}
            </div>
            <p className={`tipo-entrega${p.esgotado ? " esgotado" : ""}`}>
              {p.esgotado
                ? "Esgotado no momento"
                : p.prontaEntrega
                  ? "Pronta entrega"
                  : "Feito sob encomenda"}
            </p>
            {p.descricao && <p className="desc">{p.descricao}</p>}

            {temVariacao && (
              <fieldset
                ref={escolhaRef}
                className={`escolha${faltaEscolher && !variacao ? " com-erro" : ""}`}
                aria-describedby={faltaEscolher && !variacao ? `${uid}-erro` : undefined}
              >
                <legend>
                  {variasCores
                    ? `Escolha até ${p.maxCores} cores`
                    : p.usaPaleta
                      ? "Escolha a cor"
                      : "Escolha a opção"}
                </legend>
                {variasCores && (
                  <p className="dica-cores">
                    Uma cor só ou até {p.maxCores} misturadas, na ordem em que você tocar.
                    {noLimite ? " Pra trocar, toque numa cor escolhida." : ""}
                  </p>
                )}
                <p className="escolhida" aria-live="polite">
                  {variacao ? variacao.nome : "Nenhuma escolhida ainda"}
                </p>
                <div className={`chips${p.usaPaleta ? " amostras" : ""}`}>
                  {p.variacoes.map((v) => {
                    const marcavel = variasCores && v.id !== OPCAO_COR_DA_FOTO;
                    const posicao = marcavel ? cores.indexOf(v.id) : -1;
                    return (
                      <label
                        key={v.id}
                        className={`chip${v.hex ? " amostra" : ""}`}
                        title={v.hex ? v.nome : undefined}
                      >
                        {marcavel ? (
                          <input
                            type="checkbox"
                            value={v.id}
                            disabled={!!v.esgotada || (noLimite && posicao < 0)}
                            checked={posicao >= 0}
                            onChange={() => marcarCor(v.id)}
                          />
                        ) : (
                          <input
                            type="radio"
                            name={`${uid}-variacao`}
                            value={v.id}
                            disabled={!!v.esgotada}
                            checked={escolha === v.id && !cores.length}
                            onChange={() => {
                              setCores([]);
                              setEscolha(v.id);
                              setFaltaEscolher(false);
                            }}
                          />
                        )}
                        {posicao >= 0 && cores.length > 1 && (
                          <b className="ordem-cor" aria-hidden="true">
                            {posicao + 1}
                          </b>
                        )}
                        {v.hex ? (
                          <>
                            <i style={{ background: v.hex }} aria-hidden="true" />
                            <span className="sr-only">{v.nome}</span>
                          </>
                        ) : (
                          <>
                            {v.nome}
                            {v.esgotada && <span className="esgotada"> · esgotada</span>}
                          </>
                        )}
                      </label>
                    );
                  })}
                </div>
                {p.usaPaleta && loja.avisoCor && <p className="aviso-cor">{loja.avisoCor}</p>}
                {faltaEscolher && !variacao && (
                  <p id={`${uid}-erro`} className="erro">
                    Escolha uma opção antes de pôr no carrinho.
                  </p>
                )}
              </fieldset>
            )}

            {(p.corSobConsulta || p.tamanhoSobConsulta) && (
              <ul className="sob-consulta">
                {p.corSobConsulta && (
                  <li>Cor sob consulta: a loja combina com você pelo WhatsApp depois do pedido.</li>
                )}
                {p.tamanhoSobConsulta && (
                  <li>
                    Tamanho sob consulta: a loja combina com você pelo WhatsApp depois do pedido.
                  </li>
                )}
              </ul>
            )}

            <div className="comprar">
              {p.precoSobConsulta ? (
                consulta ? (
                  <a className="btn largo zap" href={consulta} target="_blank" rel="noopener">
                    <IconeWhatsapp />
                    <span>Consultar o preço no WhatsApp</span>
                  </a>
                ) : (
                  <p className="sob-consulta">
                    Fale com a loja pelo perfil onde você achou o link pra saber o preço.
                  </p>
                )
              ) : (
                <button
                  ref={botaoRef}
                  type="button"
                  className="btn largo"
                  onClick={porNoCarrinho}
                  disabled={p.esgotado}
                >
                  <ShoppingBag aria-hidden="true" strokeWidth={1.7} />
                  <span>{p.esgotado ? "Esgotado" : "Adicionar ao carrinho"}</span>
                </button>
              )}
            </div>
            <BeneficiosLoja loja={loja} prontaEntrega={p.prontaEntrega} />
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

      {!p.precoSobConsulta && (
        <div className={`barra-produto${barra ? " on" : ""}`}>
          <div className="nome">
            <b>{p.nome}</b>
            {variacao ? `${variacao.nome} · ${reais(p.preco)}` : reais(p.preco)}
          </div>
          <button
            type="button"
            className="btn"
            onClick={porNoCarrinho}
            tabIndex={barra ? 0 : -1}
            disabled={p.esgotado}
          >
            <ShoppingBag aria-hidden="true" strokeWidth={1.7} />
            <span>{p.esgotado ? "Esgotado" : "Adicionar"}</span>
          </button>
        </div>
      )}
    </>
  );
}
