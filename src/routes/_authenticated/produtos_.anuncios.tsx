import { createFileRoute } from "@tanstack/react-router";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { useCanaisConectados } from "@/hooks/useCanaisConectados";
import { BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";

// "Anúncios nos canais" (VND-39, aprovado pela Sil em 26/10): o caminho até
// "Ligar anúncios" a partir de Produtos, um bloco por canal conectado. Conectar
// um canal novo continua em Configurações > Integrações.

export const Route = createFileRoute("/_authenticated/produtos_/anuncios")({
  head: () => ({ meta: [{ title: "Anúncios nos canais · Pólia One" }] }),
  component: AnunciosNosCanais,
});

function AnunciosNosCanais() {
  const { canais, carregando, erro } = useCanaisConectados();

  return (
    <PaginaLogada
      titulo="Anúncios nos canais"
      eyebrow="Produtos"
      subtitulo="Ligue cada anúncio a um produto da Pólia: a venda baixa o estoque certo e o lucro sai por produto."
    >
      {carregando && (
        <p
          className="font-sans text-[var(--ink-soft)] text-[14px]"
          role="status"
          aria-live="polite"
        >
          Buscando os canais conectados...
        </p>
      )}

      {!carregando && erro && canais.length === 0 && (
        <p className="font-sans text-[var(--danger)] text-[14px]" role="alert">
          A Pólia One não conseguiu ler os canais agora. Recarrega a página para tentar de novo.
        </p>
      )}

      {!carregando && !erro && canais.length === 0 && (
        <div className="space-y-4">
          <p className="font-sans text-[var(--ink-soft)] text-[14px]">
            Nenhum canal de venda conectado ainda. Conecta o Mercado Livre ou o TikTok Shop em
            Configurações e os anúncios aparecem aqui.
          </p>
          <LinkInterno href="/configuracoes" className={BTN_ACAO_CONTORNO}>
            Ir para Integrações
          </LinkInterno>
        </div>
      )}

      {canais.length > 0 && (
        <div className="space-y-3">
          {canais.map((c) => (
            <section
              key={c.canal}
              aria-labelledby={`canal-${c.canal}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-white p-4"
            >
              <div>
                <h2
                  id={`canal-${c.canal}`}
                  className="font-sans text-[15px] font-medium text-[var(--ink)]"
                >
                  {c.nome}
                  {c.loja ? ` · ${c.loja}` : ""}
                </h2>
                <p className="font-sans text-[13px] text-[var(--ink-soft)]">
                  {c.anunciosLigados === 0
                    ? "Nenhum anúncio ligado a produto da Pólia ainda."
                    : `${c.anunciosLigados} ${c.anunciosLigados === 1 ? "anúncio ligado" : "anúncios ligados"} a produtos da Pólia.`}
                  {c.ultimoSync
                    ? ` Última sincronização ${new Date(c.ultimoSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`
                    : ""}
                </p>
              </div>
              <LinkInterno href={c.href} className={BTN_MIUDO}>
                Ligar anúncios
              </LinkInterno>
            </section>
          ))}
          <p className="font-sans text-[12px] text-[var(--muted)]">
            Conectar outro canal ou desconectar fica em{" "}
            <LinkInterno href="/configuracoes" className="text-[var(--secondary-text)] underline">
              Configurações &gt; Integrações
            </LinkInterno>
            .
          </p>
        </div>
      )}
    </PaginaLogada>
  );
}
