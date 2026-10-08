import { FileText, Pencil } from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO } from "@/lib/botoes";
import { CAMPO_LABEL, SECOES, secaoPorId } from "@/lib/planejamento";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { useLinkDoModulo } from "@/lib/useLinkDoModulo";

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
        // Módulo vem da seção, não do prefixo do id: "1.0" mora no módulo 4.
        const moduloN = secId ? secaoPorId(secId)?.modulo : undefined;
        return (
          <div key={campo}>
            <div className="flex items-baseline justify-between gap-4">
              {/* Rótulo de campo usa a label de caixa alta do sistema (DM Sans
                  700), o mesmo padrão do Rotulo de /planejamento e do Campo de
                  /configuracoes. Continua <h2> pelo sumário da página, com
                  font-accent porque Cabinet Grotesk é só de texto grande. */}
              <h2 className="text-[12px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                {CAMPO_LABEL[campo] ?? campo}
              </h2>
              {secId && moduloN && (
                <LinkInterno
                  href={`/planejamento/modulo/${moduloN}?secao=${secId}`}
                  aria-label={`Editar ${CAMPO_LABEL[campo] ?? campo}`}
                  className="-my-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--secondary-text)]"
                >
                  <Pencil size={14} aria-hidden="true" />
                </LinkInterno>
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
 * O botão só aponta pro módulo quando ele está liberado (08/10/2026): antes
 * levava direto a um módulo trancado pra quem ainda estava no começo.
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
  const link = useLinkDoModulo(moduloN);
  return (
    <Vazio
      icone={FileText}
      titulo={titulo ?? `Essa ferramenta é escrita no Módulo ${moduloN}.`}
      texto={
        <>
          {texto ?? "É de lá que ela sai pronta."}
          {!link.liberado &&
            ` O Módulo ${moduloN} abre depois dos anteriores, e o Planejamento mostra onde você está.`}
        </>
      }
      acao={
        <LinkInterno href={link.href} className={BTN_ACAO}>
          {link.liberado ? `Ir pro Módulo ${moduloN}` : "Abrir o Planejamento"}
          <span aria-hidden="true">→</span>
        </LinkInterno>
      }
    />
  );
}
