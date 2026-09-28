import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { BTN_ACAO } from "@/lib/botoes";
import { gerarRaioX } from "@/lib/raiox.functions";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { temProjete } from "@/lib/planos";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { AvisoConteudoIA } from "@/components/ui/AvisoConteudoIA";

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
        .from("ia_raiox")
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
        void registrar("feature_completed", { feature: "raiox", propriedades: { acao: "gerado" } });
        await qc.invalidateQueries({ queryKey: ["ia-raiox", userId, mesLabel] });
      } else {
        setMotivo(resultado.motivo);
        if (resultado.motivo === "falha_ia") {
          setErro("A Pólia não conseguiu ler o seu mês agora. Tenta de novo.");
        }
      }
    } catch {
      setErro("A Pólia não conseguiu ler o seu mês agora. Tenta de novo.");
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
      <UpgradeGate
        eyebrow="Raio-x do mês"
        titulo="O raio-x do mês é do Pro"
        feature="A Aimer lê os seus números reais todo mês e devolve o que puxou o resultado e o que fazer diferente."
        rota="/raiox"
      />
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
        {/* Só não existe na tela de upgrade (return acima), que não tem conteúdo de IA. */}
        <AvisoConteudoIA texto="O raio-x é gerado por inteligência artificial. Os números vêm dos dados registrados aqui; a leitura é escrita pela IA e pode errar. Vale conferir antes de decidir." />
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
                      <LinkInterno
                        href={`/${s.rota}`}
                        className="mt-1 inline-block text-[13px] font-medium text-[var(--secondary-text)] no-underline"
                      >
                        {ROTA_LABEL[s.rota]} →
                      </LinkInterno>
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
          <div className="mt-6">
            <Vazio
              icone={CalendarClock}
              titulo="O mês ainda está correndo."
              texto="A Pólia lê o que tem até aqui, ou dá pra escolher o mês passado, que já fechou."
              acao={
                <button
                  type="button"
                  onClick={() => {
                    setForcarMesAtual(true);
                    void gerar(true);
                  }}
                  className={BTN_ACAO}
                >
                  Ler o que tem até aqui
                </button>
              }
            />
          </div>
        ) : motivo === "dado_insuficiente" ? (
          <div className="mt-6">
            <Vazio
              icone={Sparkles}
              titulo="Esse mês tem pouco registrado pra dar leitura."
              texto="Lance o que entrou e saiu."
              acao={
                <Link to="/financeiro" className={BTN_ACAO}>
                  Ir pro Financeiro
                </Link>
              }
            />
          </div>
        ) : motivo === "teto_atingido" ? (
          <div className="mt-6">
            <Vazio
              icone={Sparkles}
              titulo="As gerações de raio-x deste mês acabaram."
              texto="Dá pra reler os raio-x que já saíram escolhendo outro mês."
            />
          </div>
        ) : (
          <div className="mt-6">
            <Vazio
              icone={Sparkles}
              titulo="Nenhum raio-x deste mês ainda."
              texto="Quando o seu mês tiver receitas e despesas registradas, a Aimer lê pra você o que aconteceu."
              acao={
                <>
                  <button
                    type="button"
                    onClick={() => void gerar(ehMesCorrente)}
                    disabled={gerando}
                    className={BTN_ACAO}
                  >
                    {gerando ? "A Pólia está lendo o seu mês..." : "Gerar raio-x"}
                  </button>
                  {erro && <p className="mt-3 text-[13px] text-[var(--danger)]">{erro}</p>}
                </>
              }
            />
          </div>
        )}
      </div>
    </PaginaLogada>
  );
}
