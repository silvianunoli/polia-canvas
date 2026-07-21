import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
              <h2 className="text-[1.05rem] text-[var(--ink)]">
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
            <p className="mt-1 whitespace-pre-line text-[1rem] leading-relaxed text-[var(--ink-soft)]">
              {mapa.get(campo)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// Estado "ferramenta ainda não desbloqueada" — nunca bloqueia acesso, só orienta.
export function FerramentaVazia({ moduloN, texto }: { moduloN: number; texto?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-white px-6 py-14 text-center">
      <p className="mx-auto max-w-[440px] text-[14px] leading-relaxed text-[var(--muted)]">
        {texto ?? `Essa ferramenta é desbloqueada no Módulo ${moduloN}.`}
      </p>
      <a
        href={`/planejamento/modulo/${moduloN}`}
        className="mt-4 inline-block text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
      >
        Ir pro Módulo {moduloN} →
      </a>
    </div>
  );
}
