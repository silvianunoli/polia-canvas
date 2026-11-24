import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { Switch } from "@/components/ui/switch";
import { BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { normalizarCodigoCupom, problemaDoCupomNovo } from "@/lib/lojaVitrine";
import {
  CHAVE_CUPONS_CATALOGO,
  apagarCupom,
  criarCupom,
  ligarCupom,
  useCuponsDaVitrine,
  type CupomDaVitrine,
} from "@/components/catalogo/dados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]";
const BTN_SETA =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--secondary-text)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)] disabled:opacity-40 disabled:pointer-events-none";

/**
 * Cupons de desconto (24/11/2026, ONE-239, desenho aprovado pela Sil). Cada
 * cupom salva na hora, como as cores, sem passar pela barra "Salvar a loja".
 * Cupom usado não se apaga, só desliga: o pedido antigo mostra o código.
 *
 * Os cupons são da conta: o mesmo código vale na Vitrine online e na Loja da
 * marca, com um só contador de usos. Por isso a seção aparece nas duas telas.
 */
export function CuponsDeDesconto({ userId, texto }: { userId: string; texto: string }) {
  const qc = useQueryClient();
  const q = useCuponsDaVitrine(userId);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"percentual" | "valor">("percentual");
  const [valor, setValor] = useState("");
  const [validoAte, setValidoAte] = useState("");
  const [limite, setLimite] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const recarregar = () => qc.invalidateQueries({ queryKey: [CHAVE_CUPONS_CATALOGO, userId] });
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  const criar = async () => {
    const novo = {
      codigo: normalizarCodigoCupom(codigo),
      tipo,
      valor: Number(valor.replace(",", ".")),
      validoAte: validoAte || null,
      limiteUsos: limite.trim() ? Number(limite) : null,
    };
    const problema = problemaDoCupomNovo(novo);
    if (problema) return setErro(problema);
    setOcupado(true);
    setErro(null);
    const r = await criarCupom(userId, novo);
    setOcupado(false);
    if (r.error) return setErro(r.error);
    setCodigo("");
    setValor("");
    setValidoAte("");
    setLimite("");
    toastSucesso(`Cupom ${novo.codigo} criado.`);
    recarregar();
  };
  const ligar = async (c: CupomDaVitrine, ativo: boolean) => {
    const r = await ligarCupom(c.id, ativo);
    if (r.error) return toastErro(r.error);
    recarregar();
  };
  const apagar = async (c: CupomDaVitrine) => {
    const r = await apagarCupom(c.id);
    if (r.error) return toastErro(r.error);
    recarregar();
  };
  const desconto = (c: CupomDaVitrine) =>
    c.tipo === "percentual"
      ? `${String(c.valor).replace(".", ",")}%`
      : c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const data = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const lista = q.data ?? [];

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-cabinet text-[20px] font-bold text-[var(--ink)]">Cupons de desconto</h2>
        <p className="font-sans text-[13px] text-[var(--ink-soft)] mt-1">{texto}</p>
      </div>
      {q.isError ? (
        <BlockError message="A Pólia One não conseguiu abrir os cupons agora." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : lista.length ? (
        <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]" aria-label="Cupons da loja">
          {lista.map((c) => {
            const venceu = !!c.validoAte && c.validoAte < hoje;
            const esgotou = c.limiteUsos != null && c.usos >= c.limiteUsos;
            const usos =
              c.limiteUsos != null
                ? `${c.usos} de ${c.limiteUsos} usos`
                : `${c.usos} ${c.usos === 1 ? "uso" : "usos"}, sem limite`;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="min-w-[140px] flex-1">
                  <p className="font-sans text-[15px] font-medium text-[var(--ink)]">{c.codigo}</p>
                  <p className="font-sans text-[13px] text-[var(--ink-soft)]">
                    {desconto(c)} de desconto · {c.validoAte ? `vale até ${data(c.validoAte)}` : "sem data"} · {usos}
                    {venceu ? " · venceu" : esgotou ? " · esgotou" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={c.ativo}
                    onCheckedChange={(v) => void ligar(c, v)}
                    aria-label={`Cupom ${c.codigo} valendo`}
                  />
                  {c.usos === 0 && (
                    <button
                      type="button"
                      className={`${BTN_SETA} hover:text-[var(--danger)]`}
                      onClick={() => void apagar(c)}
                      aria-label={`Apagar o cupom ${c.codigo}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-sans text-[13px] text-[var(--ink-soft)]">Nenhum cupom ainda. Crie o primeiro aqui embaixo.</p>
      )}

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="mb-3 font-sans text-[14px] font-medium text-[var(--ink)]">Novo cupom</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Campo label="Código" hint="Ex.: NATAL10">
            <input
              className={`${INPUT} uppercase`}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              maxLength={30}
              autoComplete="off"
            />
          </Campo>
          <Campo label="Tipo de desconto">
            <select className={INPUT} value={tipo} onChange={(e) => setTipo(e.target.value as "percentual" | "valor")}>
              <option value="percentual">Porcentagem (%)</option>
              <option value="valor">Valor (R$)</option>
            </select>
          </Campo>
          <Campo label={tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}>
            <input
              className={INPUT}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
          <Campo label="Vale até" hint="Opcional. Vale até o fim do dia.">
            <input className={INPUT} type="date" min={hoje} value={validoAte} onChange={(e) => setValidoAte(e.target.value)} />
          </Campo>
          <Campo label="Limite de usos" hint="Opcional. Vazio, sem limite.">
            <input
              className={INPUT}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
          </Campo>
        </div>
        {erro && (
          <p role="alert" className="mt-3 font-sans text-[13px] text-[var(--danger)]">
            {erro}
          </p>
        )}
        <button type="button" className={`${BTN_MIUDO} mt-4`} onClick={() => void criar()} disabled={ocupado}>
          {ocupado ? "Criando..." : "Criar cupom"}
        </button>
      </div>
    </section>
  );
}
