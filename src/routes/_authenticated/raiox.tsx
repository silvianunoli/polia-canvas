import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO } from "@/lib/botoes";
import { gerarRaioX } from "@/lib/raiox.functions";
import { track } from "@/lib/analytics";
import { temProjete } from "@/lib/planos";

export const Route = createFileRoute("/_authenticated/raiox")({
  head: () => ({
    meta: [
      { title: "Raio-x do mês · Pólia" },
      { name: "description", content: "A leitura do seu mês, pela Aimer." },
    ],
  }),
  component: RaioXPage,
});

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function opcoesDeMes(): { mes: number; ano: number; label: string }[] {
  const hoje = new Date();
  const opcoes = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    opcoes.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opcoes;
}

const ROTA_LABEL: Record<string, string> = {
  produtos: "Ver Produtos",
  financeiro: "Ver Financeiro",
  metas: "Ver Metas",
  clientes: "Ver Clientes",
};

interface RaioXRow {
  placar: string;
  causas: string;
  sugestoes: { texto: string; rota: string | null }[];
  dado_ralo: boolean;
}

function RaioXPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehProjete = temProjete(meta.plano);
  const qc = useQueryClient();

  const opcoes = useMemo(opcoesDeMes, []);
  const [selecionado, setSelecionado] = useState(opcoes[1] ?? opcoes[0]); // mês passado por padrão (já fechado)
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [forcarMesAtual, setForcarMesAtual] = useState(false);

  const mesLabel = `${selecionado.ano}-${String(selecionado.mes).padStart(2, "0")}`;

  const raioXQuery = useQuery({
    queryKey: ["ia-raiox", userId, mesLabel],
    enabled: !!userId && ehProjete,
    queryFn: async () => {
      const { data } = await supabase
        .from("ia_raiox" as never)
        .select("placar, causas, sugestoes, dado_ralo")
        .eq("user_id", userId!)
        .eq("mes", mesLabel)
        .maybeSingle();
      return (data as unknown as RaioXRow | null) ?? null;
    },
  });

  const gerar = async (forcar = false) => {
    setErro(null);
    setMotivo(null);
    setGerando(true);
    try {
      const resultado = await gerarRaioX({
        data: { mes: selecionado.mes, ano: selecionado.ano, forcar },
      });
      if (resultado.ok) {
        track("raiox_gerado", { mes: mesLabel });
        await qc.invalidateQueries({ queryKey: ["ia-raiox", userId, mesLabel] });
      } else {
        setMotivo(resultado.motivo);
        if (resultado.motivo === "falha_ia") {
          setErro("Não consegui ler o seu mês agora. Tenta de novo.");
        }
      }
    } catch {
      setErro("Não consegui ler o seu mês agora. Tenta de novo.");
    } finally {
      setGerando(false);
    }
  };

  // Só barra depois de saber o plano de verdade — ver `carregando` em useUserMeta.
  if (meta.carregando) {
    return (
      <PaginaLogada eyebrow="Raio-x do mês" titulo="A leitura do seu mês.">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
      </PaginaLogada>
    );
  }

  if (!ehProjete) {
    return (
      <PaginaLogada eyebrow="Raio-x do mês" titulo="O raio-x do mês é do Projete">
        <div className="rounded-xl border border-[var(--line)] bg-white p-6 md:p-8">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)]">
            <Lock size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
          </span>
          <p className="max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
            A Aimer lê os seus números reais todo mês e devolve o que puxou o resultado e o que
            fazer diferente.
          </p>
          <Link
            to="/upgrade"
            search={{ rota: "/raiox", tier: "projete" }}
            className={`${BTN_ACAO} mt-6`}
          >
            Conhecer o Projete
          </Link>
        </div>
      </PaginaLogada>
    );
  }

  const raioX = raioXQuery.data;
  const mesAtual = new Date();
  const ehMesCorrente =
    selecionado.mes === mesAtual.getMonth() + 1 && selecionado.ano === mesAtual.getFullYear();

  return (
    <PaginaLogada
      eyebrow="Raio-x do mês"
      titulo="A leitura do seu mês."
      subtitulo="A Aimer lê os números do mês fechado e devolve o que puxou o resultado."
    >
      <div>
        <select
          value={`${selecionado.mes}-${selecionado.ano}`}
          onChange={(e) => {
            const [mes, ano] = e.target.value.split("-").map(Number);
            const nova = opcoes.find((o) => o.mes === mes && o.ano === ano);
            if (nova) {
              setSelecionado(nova);
              setForcarMesAtual(false);
              setMotivo(null);
              setErro(null);
            }
          }}
          className="mt-6 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
        >
          {opcoes.map((o) => (
            <option key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
              {o.label}
            </option>
          ))}
        </select>

        {raioXQuery.isLoading ? (
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
        ) : raioX ? (
          <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-6">
            {raioX.dado_ralo && (
              <p className="mb-4 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
                Esse mês tem pouco registrado, a leitura é limitada.
              </p>
            )}
            <p className="text-[16px] leading-relaxed text-[var(--ink)]">{raioX.placar}</p>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">
              {raioX.causas}
            </p>
            {raioX.sugestoes.length > 0 && (
              <ul className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
                {raioX.sugestoes.map((s, i) => (
                  <li key={i} className="text-[14px] text-[var(--ink)]">
                    <p>{s.texto}</p>
                    {s.rota && ROTA_LABEL[s.rota] && (
                      <a
                        href={`/${s.rota}`}
                        className="mt-1 inline-block text-[13px] font-medium text-[var(--secondary-text)] no-underline"
                      >
                        {ROTA_LABEL[s.rota]} →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => void gerar(forcarMesAtual)}
              disabled={gerando}
              className="mt-5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline disabled:opacity-50"
            >
              {gerando ? "Gerando outro..." : "Gerar outro"}
            </button>
          </div>
        ) : motivo === "mes_nao_fechado" ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
            <p className="text-[14px] text-[var(--ink-soft)]">
              O mês ainda está correndo. Posso ler o que tem até aqui, ou escolha o mês passado, que
              está fechado.
            </p>
            <button
              type="button"
              onClick={() => {
                setForcarMesAtual(true);
                void gerar(true);
              }}
              className="mt-3 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              Ler o que tem até aqui
            </button>
          </div>
        ) : motivo === "dado_insuficiente" ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
            <p className="text-[14px] text-[var(--ink-soft)]">
              Esse mês tem pouco registrado pra eu ler direito. Lance o que entrou e saiu.
            </p>
            <Link
              to="/financeiro"
              className="mt-3 inline-block text-[13px] font-medium text-[var(--secondary-text)] no-underline"
            >
              Ir pro Financeiro
            </Link>
          </div>
        ) : motivo === "teto_atingido" ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
            <p className="text-[14px] text-[var(--ink-soft)]">
              Você já usou as suas gerações de raio-x desse mês.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--secondary-light)]">
              <Sparkles size={18} className="text-[var(--secondary-text)]" aria-hidden="true" />
            </span>
            <p className="text-[14px] text-[var(--ink-soft)]">
              Quando o seu mês tiver receitas e despesas registradas, a Pólia lê pra você o que
              aconteceu.
            </p>
            {erro && <p className="mt-3 text-[13px] text-[var(--danger)]">{erro}</p>}
            <button
              type="button"
              onClick={() => void gerar(ehMesCorrente)}
              disabled={gerando}
              className={`${BTN_ACAO} mt-4`}
            >
              {gerando ? "A Pólia está lendo o seu mês..." : "Gerar raio-x"}
            </button>
          </div>
        )}
      </div>
    </PaginaLogada>
  );
}
