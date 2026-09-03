import { useQuery } from "@tanstack/react-query";
import { FileText, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO } from "@/lib/botoes";
import { CAMPO_LABEL, SECOES } from "@/lib/planejamento";

// Lê os campos materializados do planejamento (KV planejamento_campos).
export function useCamposPlanejamento(userId?: string) {
  return useQuery({
    queryKey: ["planejamento-campos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await supabase
        .from("planejamento_campos" as never)
        .select("campo, valor")
        .eq("user_id", userId!);
      const rows =
        (res as unknown as { data: { campo: string; valor: string | null }[] | null }).data ?? [];
      const m = new Map<string, string>();
      for (const r of rows) if (r.valor && r.valor.trim()) m.set(r.campo, r.valor);
      return m;
    },
  });
}

function secaoDoCampo(campo: string): string | undefined {
  return SECOES.find((s) => s.perguntas.some((p) => p.campo === campo))?.id;
}

// Renderiza uma lista de campos como blocos de documento, com lápis de edição
// que leva de volta à seção correspondente do módulo.
export function CamposDoc({ mapa, campos }: { mapa: Map<string, string>; campos: string[] }) {
  const preenchidos = campos.filter((c) => mapa.has(c));
  if (preenchidos.length === 0) return null;
  return (
    <div className="space-y-6">
      {preenchidos.map((campo) => {
        const secId = secaoDoCampo(campo);
        const moduloN = secId ? Number(secId.split(".")[0]) : undefined;
        return (
          <div key={campo}>
            <div className="flex items-baseline justify-between gap-4">
              {/* Rótulo de campo usa a label de caixa alta do sistema (DM Sans
                  700), o mesmo padrão do Rotulo de /planejamento e do Campo de
                  /configuracoes. Continua <h2> pelo sumário da página, com
                  font-accent porque Cabinet Grotesk é só de texto grande. */}
              <h2 className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                {CAMPO_LABEL[campo] ?? campo}
              </h2>
              {secId && moduloN && (
                <a
                  href={`/planejamento/modulo/${moduloN}?secao=${secId}`}
                  aria-label={`Editar ${CAMPO_LABEL[campo] ?? campo}`}
                  className="shrink-0 text-[var(--muted)] hover:text-[var(--secondary-text)]"
                >
                  <Pencil size={14} aria-hidden="true" />
                </a>
              )}
            </div>
            <p className="mt-2 whitespace-pre-line text-[16px] leading-relaxed text-[var(--ink-soft)]">
              {mapa.get(campo)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Estado "ferramenta ainda não desbloqueada" — nunca bloqueia acesso, só orienta.
 * Casca fina do `Vazio` canônico: era o quinto desenho de estado vazio do produto
 * (centralizado, sem título, sem ícone, com a saída como link solto).
 */
export function FerramentaVazia({
  moduloN,
  titulo,
  texto,
}: {
  moduloN: number;
  titulo?: string;
  texto?: string;
}) {
  return (
    <Vazio
      icone={FileText}
      titulo={titulo ?? `Essa ferramenta é escrita no Módulo ${moduloN}.`}
      texto={texto ?? "É de lá que ela sai pronta."}
      acao={
        <a href={`/planejamento/modulo/${moduloN}`} className={BTN_ACAO}>
          Ir pro Módulo {moduloN}
          <span aria-hidden="true">→</span>
        </a>
      }
    />
  );
}
