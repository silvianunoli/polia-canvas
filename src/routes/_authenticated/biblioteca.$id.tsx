import { useMemo, useState, useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";

export const Route = createFileRoute("/_authenticated/biblioteca/$id")({
  head: () => ({
    meta: [
      { title: "Entregável · Pólia" },
      { name: "description", content: "Visualize e edite seu entregável." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/painel" });
    }
  },
  component: BibliotecaDetalhePage,
});

interface Entregavel {
  id: string;
  titulo: string;
  tipo: string;
  fase: string;
  etapa: number;
  conteudo: Record<string, unknown> | null;
  created_at: string;
}

type CampoTipo = "texto" | "destaque" | "lista";
interface Campo {
  chave: string;
  label: string;
  tipo: CampoTipo;
}

const camposPorTipo: Record<string, Campo[]> = {
  mini_pitch: [
    { chave: "publico", label: "QUEM VOCÊ AJUDA", tipo: "texto" },
    { chave: "solucao", label: "O QUE VOCÊ FAZ", tipo: "texto" },
    { chave: "transformacao", label: "O QUE TRANSFORMA", tipo: "texto" },
    { chave: "texto", label: "SEU PITCH COMPLETO", tipo: "destaque" },
  ],
  voz_de_marca: [
    { chave: "palavras", label: "SUAS 3 PALAVRAS", tipo: "lista" },
    { chave: "frase", label: "SUA VOZ EM UMA FRASE", tipo: "destaque" },
  ],
  mapa_posicionamento: [
    { chave: "declaracao", label: "SUA DECLARAÇÃO", tipo: "texto" },
    { chave: "diferencial", label: "SEU DIFERENCIAL", tipo: "texto" },
    { chave: "naoAlcancam", label: "O QUE OUTRAS NAO ALCANCAM", tipo: "texto" },
    { chave: "anguloUnico", label: "SEU ANGULO UNICO", tipo: "destaque" },
  ],
  ficha_produto: [
    { chave: "descricao_refinada", label: "DESCRIÇÃO", tipo: "texto" },
    { chave: "entrega", label: "COMO ENTREGA", tipo: "texto" },
    { chave: "preco_destaque", label: "PREÇO", tipo: "texto" },
    { chave: "cliente_ideal", label: "CLIENTE IDEAL", tipo: "destaque" },
  ],
  guia_presenca: [
    { chave: "canal_principal", label: "SEU CANAL PRINCIPAL", tipo: "texto" },
    { chave: "aparencia_guia", label: "COMO VOCÊ APARECE", tipo: "texto" },
    { chave: "caminho_resumido", label: "COMO A CLIENTE COMPRA", tipo: "texto" },
    { chave: "bio_sugerida", label: "SUA BIO SUGERIDA", tipo: "destaque" },
  ],
  sistema_controle: [
    { chave: "capacidade_resumida", label: "SUA CAPACIDADE", tipo: "texto" },
    { chave: "controle_atual", label: "SEU CONTROLE HOJE", tipo: "texto" },
    { chave: "gatilho_reposicao", label: "QUANDO REPOR", tipo: "texto" },
    { chave: "proximo_passo", label: "PROXIMO PASSO", tipo: "destaque" },
  ],
  roteiro_fechamento: [
    { chave: "passo_descoberta", label: "COMO ELA TE DESCOBRE", tipo: "texto" },
    { chave: "passo_decisao", label: "O QUE A CONVENCE", tipo: "texto" },
    { chave: "passo_fechamento", label: "COMO VOCÊ FECHA", tipo: "texto" },
    { chave: "mensagem_fechamento", label: "SUA MENSAGEM DE FECHAMENTO", tipo: "destaque" },
  ],
  protocolo_cuidado: [
    { chave: "boas_vindas", label: "BOAS-VINDAS", tipo: "texto" },
    { chave: "resolucao", label: "QUANDO ALGO DA ERRADO", tipo: "texto" },
    { chave: "fidelizacao", label: "COMO FIDELIZA", tipo: "texto" },
    { chave: "mensagem_pos_entrega", label: "MENSAGEM POS-ENTREGA", tipo: "destaque" },
  ],
  plano_conteudo: [
    { chave: "tipos_conteudo", label: "O QUE ELA QUER VER", tipo: "texto" },
    { chave: "gatilhos_parada", label: "O QUE PARA O SCROLL", tipo: "texto" },
    { chave: "ritmo_sugerido", label: "SEU RITMO IDEAL", tipo: "texto" },
    { chave: "ideias", label: "3 IDEIAS DE CONTEUDO", tipo: "lista" },
  ],
  painel_numeros: [
    { chave: "numero_1", label: "NÚMERO 1", tipo: "texto" },
    { chave: "numero_2", label: "NÚMERO 2", tipo: "texto" },
    { chave: "numero_3", label: "NÚMERO 3", tipo: "texto" },
    { chave: "ritmo_recomendado", label: "SEU RITMO DE REVISÃO", tipo: "texto" },
    { chave: "gatilho_principal", label: "QUANDO AGIR", tipo: "destaque" },
  ],
  plano_crescimento: [
    { chave: "visao_refinada", label: "SUA VISÃO", tipo: "texto" },
    { chave: "rede_descrita", label: "SUA REDE", tipo: "texto" },
    { chave: "proximo_passo", label: "PROXIMO PASSO", tipo: "texto" },
    { chave: "afirmacao", label: "SUA AFIRMAÇÃO", tipo: "destaque" },
  ],
};

function badgeFase(fase: string): string {
  const f = (fase || "").toLowerCase();
  if (f.includes("sonho"))
    return "bg-[rgba(201,64,122,0.12)] text-[#C9407A] border border-[rgba(201,64,122,0.3)]";
  if (f.includes("constru"))
    return "bg-[rgba(26,127,173,0.12)] text-[#1A7FAD] border border-[rgba(26,127,173,0.3)]";
  if (f.includes("venda"))
    return "bg-[rgba(26,143,92,0.12)] text-[#1A8F5C] border border-[rgba(26,143,92,0.3)]";
  if (f.includes("evolu"))
    return "bg-[rgba(107,80,204,0.12)] text-[#6B50CC] border border-[rgba(107,80,204,0.3)]";
  return "bg-[rgba(26,26,46,0.06)] text-[#1A1A2E] border border-[rgba(26,26,46,0.12)]";
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function renderListaItem(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (typeof obj.palavra === "string") return obj.palavra;
    const firstStr = Object.values(obj).find((v) => typeof v === "string");
    if (typeof firstStr === "string") return firstStr;
    return JSON.stringify(item);
  }
  return String(item);
}

function BibliotecaDetalhePage() {
  const { id } = Route.useParams();
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, unknown>>({});
  const [salvando, setSalvando] = useState(false);

  const entregavelQuery = useQuery({
    queryKey: ["biblioteca-detalhe", id, userId],
    enabled: !!userId && !!id,
    queryFn: async () => {
      const [profileRes, entregavelRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, business_name, streak")
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("entregaveis")
          .select("id, titulo, tipo, fase, etapa, conteudo, created_at")
          .eq("id", id)
          .eq("user_id", userId!)
          .maybeSingle(),
      ]);
      return {
        profile: profileRes.data,
        entregavel: entregavelRes.data as Entregavel | null,
      };
    },
  });

  const profile = entregavelQuery.data?.profile;
  const entregavel = entregavelQuery.data?.entregavel ?? null;

  useEffect(() => {
    if (entregavelQuery.isSuccess && !entregavel) {
      navigate({ to: "/biblioteca" });
    }
  }, [entregavelQuery.isSuccess, entregavel, navigate]);

  const campos = useMemo(
    () => (entregavel ? camposPorTipo[entregavel.tipo] || [] : []),
    [entregavel],
  );

  const conteudoAtual = useMemo<Record<string, unknown>>(() => {
    if (!entregavel) return {};
    return { ...(entregavel.conteudo || {}), ...rascunho };
  }, [entregavel, rascunho]);

  const cancelarEdicao = () => {
    setRascunho({});
    setEditando(false);
  };

  const salvarEdicao = async () => {
    if (!entregavel) return;
    setSalvando(true);
    const novoConteudo = { ...(entregavel.conteudo || {}), ...rascunho };
    const { error } = await supabase
      .from("entregaveis")
      .update({ conteudo: novoConteudo as never })
      .eq("id", entregavel.id);
    setSalvando(false);
    if (!error) {
      setRascunho({});
      setEditando(false);
      entregavelQuery.refetch();
    }
  };

  const initial = (
    profile?.full_name?.trim()?.[0] ||
    profile?.business_name?.trim()?.[0] ||
    "P"
  ).toUpperCase();
  const streak = profile?.streak ?? 0;

  if (entregavelQuery.isLoading || !entregavel) {
    return (
      <div className="min-h-screen bg-[#FDF8F5]">
        <PainelNav initial={initial} streak={streak} navActive="/biblioteca" />
        <main className="mx-auto max-w-[1280px] px-12 pt-10">
          <p className="font-sans text-[#1A1A2E] text-[14px] opacity-40">Carregando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} navActive="/biblioteca" />

      <main className="mx-auto max-w-[880px]">
        <div className="flex items-center gap-2 px-12 pt-8 mb-6">
          <a
            href="/biblioteca"
            className="font-sans text-[#1A1A2E] text-[13px] opacity-40 hover:opacity-70"
          >
            Seus entregáveis
          </a>
          <span className="font-sans text-[#1A1A2E] opacity-20">/</span>
          <span className="font-sans text-[#1A1A2E] text-[13px] opacity-70">
            {entregavel.titulo}
          </span>
        </div>

        <div className="px-12">
          <div className="flex items-start justify-between mb-8 max-w-[820px]">
            <div>
              <span
                className={`inline-block font-accent text-[9px] tracking-[1.5px] uppercase font-bold px-3 py-1 rounded-full mb-3 ${badgeFase(
                  entregavel.fase,
                )}`}
              >
                {entregavel.fase} · Etapa {entregavel.etapa}
              </span>
              <h1 className="font-serif text-[#1A1A2E] text-[40px] leading-tight">
                {entregavel.titulo}
              </h1>
              <p className="font-sans text-[#1A1A2E] text-[13px] opacity-40 mt-2">
                criado em {formatarData(entregavel.created_at)}
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              {editando ? (
                <>
                  <button
                    onClick={cancelarEdicao}
                    disabled={salvando}
                    className="font-sans text-[13px] text-[#1A1A2E] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2 hover:bg-[rgba(26,26,46,0.04)] transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEdicao}
                    disabled={salvando}
                    className="font-sans text-[13px] font-semibold text-polia-creme bg-polia-terracota rounded-xl px-4 py-2 hover:bg-[#B85A2D] transition-colors disabled:opacity-50"
                  >
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditando(true)}
                  className="font-sans text-[13px] text-[#C96B3E] border border-[rgba(201,107,62,0.3)] rounded-xl px-4 py-2 hover:bg-[rgba(201,107,62,0.06)] transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
          </div>

          <div className="max-w-[760px]">
            {campos.length === 0 ? (
              <p className="font-sans text-[#1A1A2E] text-[14px] opacity-40">
                Este entregável ainda não tem um formato de exibição.
              </p>
            ) : (
              campos.map((campo, i) => {
                const valor = conteudoAtual[campo.chave];
                return (
                  <div
                    key={campo.chave}
                    className={`mb-6 pb-6 ${
                      i < campos.length - 1 ? "border-b border-[rgba(26,26,46,0.06)]" : ""
                    }`}
                  >
                    <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-3">
                      {campo.label}
                    </p>

                    {campo.tipo === "destaque" ? (
                      <div className="bg-[rgba(201,107,62,0.04)] border border-[rgba(201,107,62,0.15)] rounded-xl p-5">
                        {editando ? (
                          <textarea
                            defaultValue={(valor as string) ?? ""}
                            onChange={(e) =>
                              setRascunho((prev) => ({
                                ...prev,
                                [campo.chave]: e.target.value,
                              }))
                            }
                            className="w-full caveat-decorativo text-[#1A1A2E] leading-relaxed bg-transparent resize-none outline-none min-h-[80px]"
                          />
                        ) : (
                          <p className="caveat-decorativo text-[#1A1A2E] leading-relaxed">
                            "{(valor as string) ?? ""}"
                          </p>
                        )}
                      </div>
                    ) : campo.tipo === "lista" ? (
                      <div className="space-y-3">
                        {(Array.isArray(valor) ? valor : []).map((item: unknown, idx: number) => (
                          <div key={idx} className="flex gap-3">
                            <span className="font-serif text-[#C96B3E] text-[18px] leading-none mt-0.5">
                              {idx + 1}
                            </span>
                            {editando ? (
                              <textarea
                                defaultValue={renderListaItem(item)}
                                onChange={(e) => {
                                  const nova = [
                                    ...((conteudoAtual[campo.chave] as unknown[]) ?? []),
                                  ];
                                  nova[idx] = e.target.value;
                                  setRascunho((prev) => ({
                                    ...prev,
                                    [campo.chave]: nova,
                                  }));
                                }}
                                className="flex-1 caveat-decorativo text-[#1A1A2E] bg-transparent resize-none outline-none border-b border-[rgba(26,26,46,0.1)] pb-1"
                                rows={1}
                              />
                            ) : (
                              <p className="caveat-decorativo text-[#1A1A2E] leading-snug">
                                {renderListaItem(item)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : editando ? (
                      <textarea
                        defaultValue={(valor as string) ?? ""}
                        onChange={(e) =>
                          setRascunho((prev) => ({
                            ...prev,
                            [campo.chave]: e.target.value,
                          }))
                        }
                        className="w-full font-sans text-[#1A1A2E] text-[15px] leading-relaxed bg-white border border-[rgba(26,26,46,0.12)] rounded-xl p-4 resize-none outline-none focus:border-[#C96B3E] transition-colors"
                        rows={3}
                      />
                    ) : (
                      <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
                        {(valor as string) ?? ""}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-12 pb-12 mt-8">
          <a href="/biblioteca" className="font-sans text-[#C96B3E] text-[13px] hover:underline">
            Voltar pra biblioteca
          </a>
        </div>
      </main>
    </div>
  );
}
