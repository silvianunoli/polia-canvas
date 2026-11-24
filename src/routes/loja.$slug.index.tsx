import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BannerLoja } from "@/components/loja/BannerLoja";
import { GradeProdutos } from "@/components/loja/GradeProdutos";
import { IconeWhatsapp } from "@/components/loja/icones";
import { useLojaVitrine } from "@/components/loja/LojaContexto";
import { SelosLoja } from "@/components/loja/SelosLoja";
import { BUSCA_LOJA_MINIMO, buscarProdutos, produtosDaCategoria, temFiltroDeCategoria, type LojaPublica } from "@/lib/loja";
import { linkWhatsapp } from "@/lib/lojaVitrine";

// Vitrine da loja (página inicial de /loja/<endereço>). Loader, head e casca
// ficam no layout loja.$slug.tsx; aqui só as seções, na ordem do modelo do
// Lab: banner rotativo (quando a dona sobe), abertura, selos, produtos, como encomendar e o fechamento no WhatsApp.

export const Route = createFileRoute("/loja/$slug/")({
  component: VitrinePage,
});

function VitrinePage() {
  const { loja } = useLojaVitrine();
  const contato = linkWhatsapp(loja.whatsapp, "Oi, vim pela loja online e queria tirar uma dúvida.");
  const dias = `${loja.prazoDiasUteis} ${loja.prazoDiasUteis === 1 ? "dia útil" : "dias úteis"}`;
  const temBanner = (loja.banners ?? []).length > 0;
  const [categoria, setCategoria] = useState<string | null>(null);
  const filtro = temFiltroDeCategoria(loja);
  const [busca, setBusca] = useState("");
  // Busca (ONE-239): só com vitrine grande; soma com a categoria escolhida.
  const temBusca = loja.produtos.length >= BUSCA_LOJA_MINIMO;
  const lista = buscarProdutos(filtro ? produtosDaCategoria(loja.produtos, categoria) : loja.produtos, temBusca ? busca : "");
  const verTodos = () => {
    setBusca("");
    setCategoria(null);
  };
  const mostraCores = loja.mostrarCores && loja.cores.length > 0;
  // Loja só de pronta entrega: selo e passo final sem prazo de produção.
  const todasProntas = loja.produtos.length > 0 && loja.produtos.every((p) => p.prontaEntrega);

  return (
    <>
      {temBanner && (
        // Com banner, o nome da loja sobe pra cima dele e aparece uma vez só.
        // Sem chamada, ele é o h1 da página (com o visual do olho).
        <div className="wrap topo-banner">
          {loja.chamada ? (
            <span className="olho">{loja.nome}</span>
          ) : (
            <h1 className="olho">{loja.nome}</h1>
          )}
        </div>
      )}
      <BannerLoja banners={loja.banners ?? []} nome={loja.nome} />
      <Abertura loja={loja} dias={dias} temBanner={temBanner} />

      {mostraCores && (
        // Faixa que corre com a paleta inteira (duas voltas pra emendar sem salto).
        <div className="faixa-cores" aria-hidden="true">
          <div className="faixa-trilho">
            {[...loja.cores, ...loja.cores].map((c, i) => (
              <i key={`${c.id}-${i}`} style={{ background: c.hex }} />
            ))}
          </div>
        </div>
      )}

      <div className="wrap">
        <SelosLoja loja={loja} prontaEntrega={todasProntas} />
      </div>

      <section className="wrap secao" id="produtos" aria-labelledby="t-produtos">
        <div className="secao-topo">
          <div>
            <span className="olho">A coleção</span>
            <h2 id="t-produtos">Produtos</h2>
          </div>
          {loja.produtos.length > 0 && <p>Toque num produto pra ver as fotos, as opções e pôr no carrinho.</p>}
        </div>
        {temBusca && (
          <div className="busca-loja" role="search">
            <label htmlFor="busca-produto" className="sr-only">
              Buscar produto
            </label>
            <input
              id="busca-produto"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
        )}
        {filtro && (
          <div className="categorias" role="group" aria-label="Filtrar por categoria">
            <button type="button" aria-pressed={categoria === null} onClick={() => setCategoria(null)}>
              Todos
            </button>
            {loja.categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoria === c.id}
                onClick={() => setCategoria(c.id)}
              >
                {c.nome}
              </button>
            ))}
          </div>
        )}
        {loja.produtos.length && !lista.length ? (
          <div className="vazio-loja" role="status">
            <p>{busca.trim() ? `Nenhum produto com “${busca.trim()}”.` : "Nenhum produto nessa categoria."}</p>
            <button type="button" className="ver-todos" onClick={verTodos}>
              Ver todos
            </button>
          </div>
        ) : loja.produtos.length ? (
          <GradeProdutos slug={loja.slug} produtos={lista} />
        ) : (
          <p className="vazio-loja">A vitrine está sendo montada. Volte daqui a pouco pra ver os produtos.</p>
        )}
      </section>

      {/* A grade "Escolha a sua cor" saiu em 22/11/2026 (Sil): as cores já aparecem na página de cada produto. */}

      <section className="wrap secao" id="como" aria-labelledby="t-como">
        <div className="secao-topo">
          <div>
            <span className="olho">Simples assim</span>
            <h2 id="t-como">Como encomendar</h2>
          </div>
        </div>
        <ol className="passos">
          <li className="passo">
            <b>Escolha as peças</b>
            <p>Veja as fotos, escolha a opção e ponha no carrinho quantas quiser.</p>
          </li>
          <li className="passo">
            <b>Confirme o pedido</b>
            <p>Deixe seu nome e WhatsApp e confirme. O pedido chega direto na loja.</p>
          </li>
          <li className="passo">
            <b>A loja confirma com você</b>
            <p>{loja.nome} fala com você pelo WhatsApp pra acertar pagamento e entrega.</p>
          </li>
          <li className="passo">
            <b>{todasProntas ? "Separação e entrega" : "Produção e entrega"}</b>
            <p>
              {todasProntas
                ? "Sai depois da confirmação"
                : `${loja.produtos.some((p) => p.prontaEntrega) ? "Pronta entrega sai depois da confirmação; sob encomenda fica" : "Fica"} pronto em até ${dias} depois da confirmação`}
              {loja.entregaTexto ? ` e segue pra entrega: ${loja.entregaTexto}` : " e segue pra entrega como combinado"}.
            </p>
          </li>
        </ol>
      </section>

      {contato && (
        <section className="wrap" aria-labelledby="t-fecho">
          <div className="fecho">
            <span className="olho">Ficou alguma dúvida</span>
            <h2 id="t-fecho">Fale direto com {loja.nome}</h2>
            <p>Pergunte sobre prazo, opções ou um pedido especial antes de fechar.</p>
            <a className="btn" href={contato} target="_blank" rel="noopener">
              <IconeWhatsapp />
              <span>Chamar no WhatsApp</span>
            </a>
          </div>
        </section>
      )}
    </>
  );
}

function Abertura({ loja, dias, temBanner }: { loja: LojaPublica; dias: string; temBanner: boolean }) {
  // Com banner, ele já é a imagem do topo: capa e colagem saem.
  const comFoto = temBanner ? [] : loja.produtos.filter((p) => p.fotos.length > 0).slice(0, 3);
  const capa = temBanner ? null : loja.capaUrl;
  const temImagem = !!capa || comFoto.length > 0;
  // O nome aparece uma vez só: como olho em cima da chamada, ou como o título
  // quando não há chamada. Com banner, ele já ficou em cima do banner.
  const titulo = loja.chamada ?? (temBanner ? null : loja.nome);
  return (
    <section
      className={`wrap abertura${temImagem ? " com-imagem" : ""}${temBanner ? " sob-banner" : ""}`}
      aria-labelledby={titulo ? "t-abertura" : undefined}
      aria-label={titulo ? undefined : `Sobre a ${loja.nome}`}
    >
      <div>
        {loja.chamada && !temBanner && <span className="olho">{loja.nome}</span>}
        {titulo && <h1 id="t-abertura">{titulo}</h1>}
        {loja.subchamada && <p className="sub">{loja.subchamada}</p>}
        <div className="acoes">
          <a className="btn" href="#produtos">
            Ver os produtos
          </a>
          <a className="btn sec" href="#como">
            Como encomendar
          </a>
        </div>
      </div>
      {capa ? (
        <div className="capa">
          <img src={capa} alt={`Capa da loja ${loja.nome}`} fetchPriority="high" />
        </div>
      ) : comFoto.length > 0 ? (
        <div className={`colagem n${comFoto.length}`}>
          {comFoto.map((p, i) => (
            <figure key={p.id} className={`c${i + 1}`}>
              <img src={p.fotos[0]} alt={p.nome} fetchPriority={i === 0 ? "high" : undefined} />
            </figure>
          ))}
          <div className="etiqueta">
            <b>{dias}</b>
            pra ficar pronto depois da confirmação
          </div>
        </div>
      ) : null}
    </section>
  );
}
