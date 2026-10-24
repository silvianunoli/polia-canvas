import { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import {
  FORMAS_RECEBIMENTO,
  ROTULO_TAXA,
  lerNumero,
  validarRegra,
  type FormaRecebimento,
} from "@/lib/taxas";
import { descreverTabelaTiktok } from "../../../supabase/functions/_shared/taxaTiktokShop";
import { salvarFreteGratisTiktok, salvarTaxas, useTaxas, type TaxasDaConta } from "./taxasDados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-right text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] aria-[invalid=true]:border-[var(--danger)]";

type Rascunho = Record<FormaRecebimento, { percentual: string; fixo: string }>;

const paraTexto = (v: number | undefined) =>
  v ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "";

/**
 * Taxa de cada forma de recebimento, cadastrada uma vez (ONE-128). O modal de
 * venda usa pra preencher a taxa sozinho; ela continua podendo mudar na venda.
 */
export function ModalTaxas({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const query = useTaxas(userId);
  if (query.isError)
    return (
      <Modal open onOpenChange={(n) => !n && onClose()} title="Taxas de recebimento">
        <div role="alert">
          <BlockError
            message="A Pólia One não conseguiu ler as suas taxas agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => void query.refetch()}
          />
        </div>
      </Modal>
    );
  if (!query.isSuccess)
    return (
      <Modal open onOpenChange={(n) => !n && onClose()} title="Taxas de recebimento">
        <p className="text-[14px] text-[var(--muted)]">Carregando as suas taxas…</p>
      </Modal>
    );
  return <FormularioTaxas userId={userId} taxas={query.data} onClose={onClose} onSaved={onSaved} />;
}

function FormularioTaxas({
  userId,
  taxas,
  onClose,
  onSaved,
}: {
  userId: string;
  taxas: TaxasDaConta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(() => {
    const r = {} as Rascunho;
    for (const f of FORMAS_RECEBIMENTO)
      r[f] = { percentual: paraTexto(taxas[f]?.percentual), fixo: paraTexto(taxas[f]?.fixo) };
    return r;
  });
  const freteGratisAntes = taxas.tiktok_shop?.freteGratis === true;
  const [freteGratis, setFreteGratis] = useState(freteGratisAntes);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ajudaId = useId();

  const regras = FORMAS_RECEBIMENTO.map((f) => ({
    forma: f,
    regra: { percentual: lerNumero(rascunho[f].percentual), fixo: lerNumero(rascunho[f].fixo) },
  }));
  const comErro = regras.filter((r) => validarRegra(r.regra));

  const mudar = (f: FormaRecebimento, campo: "percentual" | "fixo", valor: string) =>
    setRascunho((atual) => ({ ...atual, [f]: { ...atual[f], [campo]: valor } }));

  const salvar = async () => {
    if (comErro.length > 0) return;
    setSalvando(true);
    setErro(null);
    const novas: TaxasDaConta = {};
    for (const { forma, regra } of regras) novas[forma] = regra;
    let { error } = await salvarTaxas(userId, novas);
    if (!error && freteGratis !== freteGratisAntes)
      ({ error } = await salvarFreteGratisTiktok(userId, freteGratis));
    setSalvando(false);
    if (error) {
      console.error("taxas_salvar", error);
      setErro("A Pólia One não conseguiu salvar as taxas agora. Tenta de novo.");
      return;
    }
    track("taxas_recebimento_salvas", {
      preenchidas: regras.filter((r) => r.regra.percentual || r.regra.fixo).length,
    });
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(n) => !n && onClose()}
      title="Taxas de recebimento"
      description="Quanto a maquininha, o Pix ou o link levam de cada venda. A Pólia One usa pra preencher a taxa ao registrar uma venda."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || comErro.length > 0}
            className={BTN_ACAO}
          >
            {salvando ? "Salvando…" : "Salvar taxas"}
          </button>
        </>
      }
    >
      <table className="w-full text-[14px]">
        <caption className="sr-only">Taxa por forma de recebimento</caption>
        <thead>
          <tr className="text-left text-[12px] text-[var(--muted)]">
            <th scope="col" className="pb-2 font-normal">
              Forma
            </th>
            <th scope="col" className="w-24 pb-2 text-right font-normal">
              % da venda
            </th>
            <th scope="col" className="w-28 pb-2 pl-2 text-right font-normal">
              + R$ por venda
            </th>
          </tr>
        </thead>
        <tbody>
          {regras.map(({ forma, regra }) => {
            const problema = validarRegra(regra);
            return (
              <tr key={forma} className="border-t border-[var(--line)]">
                <th scope="row" className="py-2 pr-2 text-left font-normal text-[var(--ink-soft)]">
                  {ROTULO_TAXA[forma]}
                </th>
                <td className="py-2">
                  <input
                    inputMode="decimal"
                    value={rascunho[forma].percentual}
                    onChange={(e) => mudar(forma, "percentual", e.target.value)}
                    aria-label={`Percentual da taxa: ${ROTULO_TAXA[forma]}`}
                    aria-invalid={problema === "percentual_invalido"}
                    aria-describedby={problema === "percentual_invalido" ? ajudaId : undefined}
                    placeholder="0"
                    className={INPUT}
                  />
                </td>
                <td className="py-2 pl-2">
                  <input
                    inputMode="decimal"
                    value={rascunho[forma].fixo}
                    onChange={(e) => mudar(forma, "fixo", e.target.value)}
                    aria-label={`Valor fixo por venda: ${ROTULO_TAXA[forma]}`}
                    aria-invalid={problema === "fixo_invalido"}
                    aria-describedby={problema === "fixo_invalido" ? ajudaId : undefined}
                    placeholder="0"
                    className={INPUT}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <fieldset className="mt-5 border-t border-[var(--line)] pt-4">
        <legend className="text-[14px] font-medium text-[var(--ink)]">TikTok Shop</legend>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          A Pólia One usa a tarifa oficial do TikTok, por item: {descreverTabelaTiktok()}.
        </p>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-[14px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={freteGratis}
            onChange={(e) => setFreteGratis(e.target.checked)}
            className="h-4 w-4 accent-[var(--secondary-text)]"
          />
          Participo do Programa de Frete Grátis do TikTok (mais 6% por item, até R$ 50)
        </label>
      </fieldset>

      <p id={ajudaId} aria-live="polite" className="mt-3 text-[13px] text-[var(--muted)]">
        {comErro.length > 0
          ? `Confira ${comErro.map((r) => ROTULO_TAXA[r.forma]).join(", ")}: use só número, com até 2 casas depois da vírgula, de 0 a 100 no percentual e de 0 a 100.000 no valor fixo.`
          : "Deixe em branco a forma que não cobra nada. Os valores ficam no extrato ou no app da maquininha."}
      </p>
      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}
