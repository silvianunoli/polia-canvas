import { createFileRoute } from "@tanstack/react-router";
import { GradeProdutos } from "@/components/loja/GradeProdutos";
import { IconeWhatsapp } from "@/components/loja/icones";
import { useLojaVitrine } from "@/components/loja/LojaContexto";
import { SelosLoja } from "@/components/loja/SelosLoja";
import type { LojaPublica } from "@/lib/loja";
import { linkWhatsapp } from "@/lib/lojaVitrine";

// Vitrine da loja (página inicial de /loja/<endereço>). Loader, head e casca
// ficam no layout loja.$slug.tsx; aqui só as seções, na ordem do modelo do
// Lab: abertura, selos, produtos, como encomendar e o fechamento no WhatsApp.

export const Route = createFileRoute("/loja/$slug/")({
  component: VitrinePage,
});

function VitrinePage() {
  const { loja } = useLojaVitrine();
  const contato = linkWhatsapp(loja.whatsapp, "Oi, vim pela loja online e queria tirar uma dúvida.");
  const dias = `${loja.prazoDiasUteis} ${loja.prazoDiasUteis === 1 ? "dia útil" : "dias úteis"}`;

  return (
    <>
      <Abertura loja={loja} dias={dias} />

      <div className="wrap">
        <SelosLoja loja={loja} />
      </div>

      <section className="wrap secao" id="produtos" aria-labelledby="t-produtos">
        <div className="secao-topo">
          <div>
            <span className="olho">A coleção</span>
            <h2 id="t-produtos">Produtos</h2>
          </div>
          {loja.produtos.length > 0 && <p>Toque num produto pra ver as fotos, as opções e pôr no carrinho.</p>}
        </div>
        {loja.produtos.length ? (
          <GradeProdutos slug={loja.slug} produtos={loja.produtos} />
        ) : (
          <p className="vazio-loja">A vitrine está sendo montada. Volte daqui a pouco pra ver os produtos.</p>
        )}
      </section>

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
            <b>Produção e entrega</b>
            <p>
              Fica pronto em até {dias} depois da confirmação
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

function Abertura({ loja, dias }: { loja: LojaPublica; dias: string }) {
  const comFoto = loja.produtos.filter((p) => p.fotos.length > 0).slice(0, 3);
  const temImagem = !!loja.capaUrl || comFoto.length > 0;
  return (
    <section className={`wrap abertura${temImagem ? " com-imagem" : ""}`} aria-labelledby="t-abertura">
      <div>
        <span className="olho">{loja.nome}</span>
        <h1 id="t-abertura">{loja.chamada ?? loja.nome}</h1>
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
      {loja.capaUrl ? (
        <div className="capa">
          <img src={loja.capaUrl} alt={`Capa da loja ${loja.nome}`} fetchPriority="high" />
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
