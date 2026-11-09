import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BTN_MIUDO } from "@/lib/botoes";
import { baixarCsv, gerarCsv } from "@/lib/csv";
import { hojeISO } from "@/lib/data.functions";

interface AvaliacaoDaLoja {
  id: string;
  nome: string;
  nota: number;
  texto: string;
  visivel: boolean;
  criado_em: string;
  produto: string;
}

interface ContatosDaLoja {
  emails: Array<{ email: string; criado_em: string }>;
  avaliacoes: AvaliacaoDaLoja[];
}

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * O que a loja online recebe de quem visita: e-mails para novidades e avaliações.
 * Só aparece para a conta dona de uma loja (linha em lojas_marca).
 */
export function DaLojaOnline({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: temLoja } = useQuery({
    queryKey: ["loja-marca-existe", userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from("lojas_marca" as never).select("user_id").eq("user_id", userId).maybeSingle();
      return !error && (data as unknown) != null;
    },
  });

  const chave = ["loja-contatos", userId];
  const { data, isLoading, isError } = useQuery({
    queryKey: chave,
    enabled: temLoja === true,
    queryFn: async (): Promise<ContatosDaLoja> => {
      const { data: r, error } = await supabase.rpc("loja_painel_contatos" as never);
      if (error) throw error;
      return (r ?? { emails: [], avaliacoes: [] }) as unknown as ContatosDaLoja;
    },
  });

  if (temLoja !== true) return null;

  const trocarVisivel = async (a: AvaliacaoDaLoja) => {
    setOcupado(a.id);
    setErro(null);
    const { error } = await supabase.rpc("loja_avaliacao_visivel" as never, { p_id: a.id, p_visivel: !a.visivel } as never);
    if (error) {
      console.error("loja_avaliacao_visivel", error);
      setErro("A Pólia One não conseguiu mudar a avaliação. Tenta de novo.");
    } else {
      await qc.invalidateQueries({ queryKey: chave });
    }
    setOcupado(null);
  };

  const exportar = () => {
    if (!data) return;
    baixarCsv(
      `emails-loja-${hojeISO()}.csv`,
      gerarCsv(
        ["E-mail", "Cadastrado em"],
        data.emails.map((e) => [e.email, dataBr(e.criado_em)]),
      ),
    );
  };

  return (
    <section className="mt-8 grid gap-4 lg:grid-cols-2" aria-label="Da loja online">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-cabinet text-[18px] text-[var(--ink)]">E-mails da loja online</h2>
          {!!data?.emails.length && (
            <button type="button" className={BTN_MIUDO} onClick={exportar}>
              Exportar
            </button>
          )}
        </div>
        {isLoading && <p className="mt-3 text-[13px] text-[var(--muted)]">Carregando.</p>}
        {isError && <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">A Pólia One não conseguiu ler os dados da loja agora.</p>}
        {data?.emails.length === 0 && <p className="mt-3 text-[13px] text-[var(--muted)]">Quem se cadastrar no rodapé da loja aparece aqui.</p>}
        {!!data?.emails.length && (
          <ul className="mt-3 max-h-80 overflow-y-auto">
            {data.emails.map((e) => (
              <li key={e.email} className="flex justify-between gap-3 border-t border-[var(--line)] py-2 text-[14px] text-[var(--ink)]">
                <span className="min-w-0 break-all">{e.email}</span>
                <span className="shrink-0 text-[13px] text-[var(--muted)]">{dataBr(e.criado_em)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <h2 className="font-cabinet text-[18px] text-[var(--ink)]">Avaliações da loja online</h2>
        {isLoading && <p className="mt-3 text-[13px] text-[var(--muted)]">Carregando.</p>}
        {data?.avaliacoes.length === 0 && <p className="mt-3 text-[13px] text-[var(--muted)]">As avaliações de quem comprou aparecem aqui.</p>}
        {erro && <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">{erro}</p>}
        {!!data?.avaliacoes.length && (
          <ul className="mt-3 max-h-80 overflow-y-auto">
            {data.avaliacoes.map((a) => (
              <li key={a.id} className="border-t border-[var(--line)] py-3 text-[14px] text-[var(--ink)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0">
                    <span className="font-medium">{a.produto}</span>
                    <span className="text-[var(--ink-soft)]"> · nota {a.nota} de 5</span>
                  </p>
                  <button type="button" className={BTN_MIUDO} disabled={ocupado === a.id} onClick={() => void trocarVisivel(a)}>
                    {a.visivel ? "Tirar da loja" : "Mostrar na loja"}
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-line">{a.texto}</p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  {a.nome}, {dataBr(a.criado_em)}
                  {!a.visivel && " · fora da loja"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
