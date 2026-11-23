import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { useProdutosComEstoque, useVendas } from "@/components/vendas/dados";
import { formatarReais } from "@/lib/formatarReais";
import { intervaloDoPeriodo } from "@/lib/vendas";
import {
  menosVendidos,
  resumoProdutos,
  ticketMedio,
  topMaisVendidos,
} from "@/lib/painelOperacional";

const ROTULO = "text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]";
const LINK = "font-medium text-[var(--secondary-text)] no-underline hover:underline";

/**
 * Bloco "Produtos e vendas · mês" do Painel (23/11/2026, desenho em cinza
 * aprovado pela Sil). Entrou no lugar do cartão "Vendas · mês": quantos
 * produtos estão ativos e arquivados, quantos acabaram, o ticket médio e os
 * mais e menos vendidos do mês. A regra mora em lib/painelOperacional.
 *
 * Leitura que falha some com o bloco, como os outros cartões do Painel: um
 * número errado aqui seria pior que nenhum.
 */
export function CartaoProdutosVendasPainel({
  userId,
  vendasLiberado,
}: {
  userId: string;
  /** Sem a tela /vendas no plano, o link "Ver vendas" não aparece. */
  vendasLiberado: boolean;
}) {
  const { de, ate } = useMemo(() => intervaloDoPeriodo("mes", new Date()), []);
  const vendasQuery = useVendas(userId, de, ate);
  const produtosQuery = useProdutosComEstoque(userId);
  const inativosQuery = useQuery({
    queryKey: ["painel-produtos-inativos", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("produtos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("arquivado", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const vendas = useMemo(() => vendasQuery.data ?? [], [vendasQuery.data]);
  const ativos = useMemo(() => produtosQuery.data ?? [], [produtosQuery.data]);
  const resumo = useMemo(
    () => resumoProdutos(ativos, inativosQuery.data ?? 0),
    [ativos, inativosQuery.data],
  );
  const ticket = useMemo(() => ticketMedio(vendas), [vendas]);
  const maisVendidosMes = useMemo(() => topMaisVendidos(vendas), [vendas]);
  const menosVendidosMes = useMemo(() => menosVendidos(vendas, ativos), [vendas, ativos]);

  if (vendasQuery.isError || produtosQuery.isError || inativosQuery.isError) return null;

  const carregando = vendasQuery.isLoading || produtosQuery.isLoading || inativosQuery.isLoading;
  if (carregando) {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando produtos e vendas"
        className="h-[220px] animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
      />
    );
  }

  if (resumo.ativos === 0 && resumo.inativos === 0) {
    return (
      <section
        aria-labelledby="painel-produtos-vendas"
        className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
      >
        <h2 id="painel-produtos-vendas" className={ROTULO}>
          Produtos e vendas · mês
        </h2>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Nenhum produto cadastrado ainda.{" "}
          <LinkInterno href="/produtos" className={LINK}>
            Cadastrar produto →
          </LinkInterno>
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="painel-produtos-vendas"
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="painel-produtos-vendas" className={ROTULO}>
          Produtos e vendas · mês
        </h2>
        <p className="text-[13px]">
          <LinkInterno href="/produtos" className={LINK}>
            Ver produtos
          </LinkInterno>
          {vendasLiberado && (
            <>
              <span aria-hidden="true" className="text-[var(--muted)]">
                {" "}
                ·{" "}
              </span>
              <LinkInterno href="/vendas" className={LINK}>
                Ver vendas
              </LinkInterno>
            </>
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Ativos" valor={String(resumo.ativos)} />
        <Numero rotulo="Inativos" valor={String(resumo.inativos)} legenda="arquivados" />
        <Numero
          rotulo="Sem estoque"
          valor={String(resumo.semEstoque)}
          legenda={
            resumo.estoqueBaixo > 0
              ? `+ ${resumo.estoqueBaixo} com estoque baixo`
              : "com o estoque ligado"
          }
          href={resumo.semEstoque + resumo.estoqueBaixo > 0 ? "/produtos?aba=estoque" : undefined}
        />
        <Numero
          rotulo="Ticket médio"
          valor={formatarReais(ticket.ticket ?? 0)}
          legenda={`${ticket.vendas} ${ticket.vendas === 1 ? "venda" : "vendas"} no mês`}
        />
      </div>

      {maisVendidosMes.length === 0 ? (
        <p className="mt-4 text-[13px] text-[var(--muted)]">
          Nenhuma venda registrada este mês. Os mais e os menos vendidos aparecem com a primeira.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Lista
            titulo="Mais vendidos"
            linhas={maisVendidosMes.map((l, i) => ({
              chave: l.chave,
              nome: `${i + 1}. ${l.produtoNome}`,
              detalhe: `${l.unidades} un · ${formatarReais(l.entrou)}`,
            }))}
          />
          <Lista
            titulo="Menos vendidos"
            vazio="Todos os produtos ativos estão entre os mais vendidos."
            linhas={menosVendidosMes.map((l) => ({
              chave: l.id,
              nome: l.produtoNome,
              detalhe:
                l.unidades === 0 ? "sem venda" : `${l.unidades} un · ${formatarReais(l.entrou)}`,
            }))}
          />
        </div>
      )}
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  legenda,
  href,
}: {
  rotulo: string;
  valor: string;
  legenda?: string;
  href?: string;
}) {
  const conteudo = (
    <>
      <p className="text-[12px] text-[var(--muted)]">{rotulo}</p>
      <p className="font-cabinet mt-0.5 text-[26px] leading-none text-[var(--ink)]">{valor}</p>
      {legenda && <p className="mt-1 text-[12px] text-[var(--muted)]">{legenda}</p>}
    </>
  );
  const base = "block rounded-lg border border-[var(--line)] bg-white p-3";
  if (!href) return <div className={base}>{conteudo}</div>;
  return (
    <LinkInterno
      href={href}
      className={`${base} no-underline transition-colors duration-150 hover:border-[var(--secondary)]`}
    >
      {conteudo}
    </LinkInterno>
  );
}

function Lista({
  titulo,
  linhas,
  vazio,
}: {
  titulo: string;
  linhas: { chave: string; nome: string; detalhe: string }[];
  vazio?: string;
}) {
  return (
    <div>
      <h3 className={ROTULO}>{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--muted)]">{vazio}</p>
      ) : (
        <ul className="mt-2">
          {linhas.map((l) => (
            <li
              key={l.chave}
              className="flex items-baseline justify-between gap-3 border-t border-[var(--line)] py-2 text-[14px]"
            >
              <span className="min-w-0 truncate text-[var(--ink-soft)]" title={l.nome}>
                {l.nome}
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-[var(--muted)]">
                {l.detalhe}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
