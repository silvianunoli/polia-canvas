import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { Campo } from "@/components/ui/Campo";
import { AvisoConteudoIA } from "@/components/ui/AvisoConteudoIA";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { gerarPlanoConteudo } from "@/lib/planoConteudo.functions";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { temProjete } from "@/lib/planos";

export const Route = createFileRoute("/_authenticated/plano-conteudo")({
  head: () => ({
    meta: [
      { title: "Plano de conteúdo do ano · Pólia One" },
      { name: "description", content: "365 ideias de post pras suas redes, pela Pólia One." },
    ],
  }),
  component: PlanoConteudoPage,
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

const TIPO_LABEL: Record<string, string> = {
  feed: "Feed",
  stories: "Stories",
  reels: "Reels",
  carrossel: "Carrossel",
};

interface DiaRow {
  id: string;
  data: string; // "YYYY-MM-DD"
  tipo: string;
  titulo: string;
  ideia: string;
  postado: boolean;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function PlanoConteudoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehProjete = temProjete(meta.plano);
  const qc = useQueryClient();

  const anoAtual = new Date().getFullYear();
  const [mesAtivo, setMesAtivo] = useState(new Date().getMonth() + 1);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);

  const planoQuery = useQuery({
    queryKey: ["ia-plano-conteudo", userId, anoAtual],
    enabled: !!userId && ehProjete,
    queryFn: async () => {
      const { data } = await supabase
        .from("ia_plano_conteudo")
        .select("id, data, tipo, titulo, ideia, postado")
        .eq("user_id", userId!)
        .eq("ano", anoAtual)
        .order("data", { ascending: true });
      return ((data ?? []) as unknown as DiaRow[]) ?? [];
    },
  });

  const dias = useMemo(() => planoQuery.data ?? [], [planoQuery.data]);
  const diasDoMesAtivo = useMemo(
    () => dias.filter((d) => Number(d.data.split("-")[1]) === mesAtivo),
    [dias, mesAtivo],
  );
  const itemDeHoje = useMemo(() => dias.find((d) => d.data === hojeISO()) ?? null, [dias]);
  const precisaLembrar = !!itemDeHoje && !itemDeHoje.postado;

  const gerar = async () => {
    setErro(null);
    setMotivo(null);
    setGerando(true);
    try {
      const resultado = await gerarPlanoConteudo({ data: { ano: anoAtual } });
      if (resultado.ok) {
        track("plano_conteudo_gerado", { ano: anoAtual });
        void registrar("feature_completed", {
          feature: "plano_conteudo",
          propriedades: { acao: "gerado" },
        });
        await qc.invalidateQueries({ queryKey: ["ia-plano-conteudo", userId, anoAtual] });
      } else {
        setMotivo(resultado.motivo);
        if (resultado.motivo === "falha_ia") {
          setErro("A Pólia One não conseguiu montar o seu plano agora. Tenta de novo.");
        }
      }
    } catch {
      setErro("A Pólia One não conseguiu montar o seu plano agora. Tenta de novo.");
    } finally {
      setGerando(false);
    }
  };

  // marcarPostado/salvarCampo aplicam um patch otimista só na linha editada em
  // vez de invalidateQueries (que refazia o fetch do ano inteiro a cada
  // clique/blur) — o UPDATE já confirmou no servidor antes do patch local.
  const marcarPostado = async (row: DiaRow, postado: boolean) => {
    await supabase
      .from("ia_plano_conteudo")
      .update({ postado, postado_em: postado ? new Date().toISOString() : null })
      .eq("id", row.id);
    qc.setQueryData<DiaRow[]>(["ia-plano-conteudo", userId, anoAtual], (old) =>
      old?.map((d) => (d.id === row.id ? { ...d, postado } : d)),
    );
  };

  const salvarCampo = async (row: DiaRow, campo: "titulo" | "ideia" | "tipo", valor: string) => {
    if (valor === row[campo]) return;
    // Update por branch em vez de `{ [campo]: valor }` — a chave computada
    // com tipo união não bate com o Update gerado do Supabase sem `as never`.
    const query = supabase.from("ia_plano_conteudo");
    if (campo === "titulo") {
      await query.update({ titulo: valor }).eq("id", row.id);
    } else if (campo === "ideia") {
      await query.update({ ideia: valor }).eq("id", row.id);
    } else {
      await query.update({ tipo: valor }).eq("id", row.id);
    }
    qc.setQueryData<DiaRow[]>(["ia-plano-conteudo", userId, anoAtual], (old) =>
      old?.map((d) => (d.id === row.id ? { ...d, [campo]: valor } : d)),
    );
  };

  // Só barra depois de saber o plano de verdade — ver `carregando` em useUserMeta.
  if (meta.carregando) {
    return (
      <PaginaLogada eyebrow="Plano de conteúdo" titulo="Uma ideia de post pra cada dia do ano.">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
      </PaginaLogada>
    );
  }

  if (!ehProjete) {
    return (
      <UpgradeGate
        eyebrow="Plano de conteúdo"
        titulo="O plano de conteúdo do ano é do Pro"
        feature="A Pólia One monta 365 ideias de post pras suas redes, uma por dia, a partir da sua marca e do seu público."
        rota="/plano-conteudo"
      />
    );
  }

  return (
    <PaginaLogada
      dica="plano-conteudo"
      largura="larga"
      eyebrow="Plano de conteúdo"
      titulo="Uma ideia de post pra cada dia do ano."
      subtitulo="Montado a partir da sua marca, do seu público e do que você vende."
    >
      <div>
        {/* Só não existe na tela de upgrade (return acima), que não tem conteúdo de IA. */}
        <AvisoConteudoIA texto="O plano de conteúdo é gerado por inteligência artificial. São sugestões pra ajustar, não um calendário fechado, e a IA pode errar. Vale ler antes de publicar." />
        {precisaLembrar && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--secondary-light)] px-4 py-3">
            <p className="text-[14px] text-[var(--ink)]">
              O tema de hoje ainda não foi marcado como postado:{" "}
              <strong>{itemDeHoje!.titulo}</strong>
            </p>
            <button
              type="button"
              onClick={() => void marcarPostado(itemDeHoje!, true)}
              className={`${BTN_MIUDO} ml-4 shrink-0 bg-white`}
            >
              Já postei
            </button>
          </div>
        )}

        {planoQuery.isLoading ? (
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
        ) : dias.length > 0 ? (
          <>
            <div className="mt-6">
              <Campo label="Mês">
                <select
                  value={mesAtivo}
                  onChange={(e) => setMesAtivo(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
                >
                  {MESES.map((nome, i) => (
                    <option key={nome} value={i + 1}>
                      {nome} {anoAtual}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>

            <ul className="mt-4 space-y-3">
              {diasDoMesAtivo.map((row) => (
                <li key={row.id} className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-end gap-2">
                      <span className="text-[13px] font-medium text-[var(--muted)]">
                        {row.data.split("-")[2]}
                      </span>
                      <Campo label="Tipo de post">
                        <select
                          value={row.tipo}
                          onChange={(e) => void salvarCampo(row, "tipo", e.target.value)}
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[12px] text-[var(--ink-soft)]"
                        >
                          {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                            <option key={valor} value={valor}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Campo>
                    </div>
                    <button
                      type="button"
                      onClick={() => void marcarPostado(row, !row.postado)}
                      aria-pressed={row.postado}
                      className={`${BTN_MIUDO} shrink-0 ${row.postado ? "!bg-[var(--secondary)]" : "bg-white"}`}
                    >
                      <Check size={13} aria-hidden="true" />
                      {row.postado ? "Postado" : "Marcar como postado"}
                    </button>
                  </div>
                  <div className="mt-2">
                    <Campo label="Título do post">
                      <input
                        defaultValue={row.titulo}
                        onBlur={(e) => void salvarCampo(row, "titulo", e.target.value)}
                        className="w-full rounded-md border-none bg-transparent p-0 text-[15px] font-medium text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--secondary-text)]"
                      />
                    </Campo>
                  </div>
                  <div className="mt-1">
                    <Campo label="Ideia do post">
                      <textarea
                        defaultValue={row.ideia}
                        onBlur={(e) => void salvarCampo(row, "ideia", e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-md border-none bg-transparent p-0 text-[14px] text-[var(--ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--secondary-text)]"
                      />
                    </Campo>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : motivo === "planejamento_incompleto" ? (
          <div className="mt-6">
            <Vazio
              icone={Sparkles}
              titulo="Ainda falta saber da sua marca."
              texto="A Pólia One precisa saber mais sobre a sua marca antes de montar o plano. Responda o básico no Planejamento e volte aqui."
              acao={
                <Link to="/planejamento" className={BTN_ACAO}>
                  Ir pro Planejamento
                </Link>
              }
            />
          </div>
        ) : motivo === "teto_atingido" ? (
          <div className="mt-6">
            <Vazio
              icone={Sparkles}
              titulo="As gerações do plano deste ano acabaram."
              texto="Se precisar de outro, abre um chamado que a Pólia One resolve."
            />
          </div>
        ) : (
          <div className="mt-6">
            <Vazio
              icone={Sparkles}
              titulo={`Nenhum plano de conteúdo pra ${anoAtual} ainda.`}
              texto={`A Pólia One monta 365 ideias de post pra ${anoAtual}, uma por dia, a partir da sua marca, do seu público e do que você vende.`}
              acao={
                <>
                  <button
                    type="button"
                    onClick={() => void gerar()}
                    disabled={gerando}
                    className={BTN_ACAO}
                  >
                    {gerando
                      ? "A Pólia One está montando o seu plano..."
                      : "Gerar plano de conteúdo"}
                  </button>
                  {gerando && (
                    <p className="mt-2 text-[12px] text-[var(--muted)]">
                      Isso pode levar um minuto.
                    </p>
                  )}
                  {erro && (
                    <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
                      {erro}
                    </p>
                  )}
                </>
              }
            />
          </div>
        )}

        {dias.length > 0 && (
          <button
            type="button"
            onClick={() => void gerar()}
            disabled={gerando}
            className="mt-6 inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {gerando ? "Gerando outro..." : "Gerar outro plano"}
          </button>
        )}
        {dias.length > 0 && erro && (
          <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
            {erro}
          </p>
        )}
      </div>
    </PaginaLogada>
  );
}
