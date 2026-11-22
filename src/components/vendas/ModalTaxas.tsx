import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import {
  FORMAS_RECEBIMENTO,
  MARKETPLACES_COM_TAXA,
  MAX_NOME_MARKETPLACE,
  ROTULO_TAXA,
  chaveDoMarketplace,
  lerNumero,
  validarRegra,
  type ChaveTaxa,
  type MarketplaceProprio,
  type RegraTaxa,
} from "@/lib/taxas";
import { descreverTabelaTiktok } from "../../../supabase/functions/_shared/taxaTiktokShop";
import { salvarFreteGratisTiktok, salvarTaxas, useTaxas, type TaxasDaConta } from "./taxasDados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-right text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] aria-[invalid=true]:border-[var(--danger)]";
const INPUT_NOME =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] aria-[invalid=true]:border-[var(--danger)]";

type Campos = { percentual: string; fixo: string };
type Rascunho = Record<ChaveTaxa, Campos>;
/** Marketplace criado à mão, enquanto ela digita. `chaveSalva` = já existe no banco. */
type ProprioRascunho = Campos & { id: number; nome: string; chaveSalva: string | null };

const CHAVES_FIXAS: ChaveTaxa[] = [...FORMAS_RECEBIMENTO, ...MARKETPLACES_COM_TAXA];

const paraTexto = (v: number | undefined) =>
  v ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "";
const lerRegra = (c: Campos): RegraTaxa => ({ percentual: lerNumero(c.percentual), fixo: lerNumero(c.fixo) });
const preenchida = (c: Campos) => !!(c.percentual.trim() || c.fixo.trim());

/**
 * Taxa de cada forma de recebimento e de cada marketplace, cadastrada uma vez
 * (ONE-128). O modal de venda usa pra preencher a taxa sozinho; ela continua
 * podendo mudar na venda. Desde 22/11/2026 o TikTok Shop aceita taxa digitada
 * (em branco segue a tabela oficial) e ela cria os marketplaces dela à mão.
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
    for (const c of CHAVES_FIXAS)
      r[c] = { percentual: paraTexto(taxas[c]?.percentual), fixo: paraTexto(taxas[c]?.fixo) };
    return r;
  });
  const proxId = useRef(0);
  const [proprios, setProprios] = useState<ProprioRascunho[]>(() =>
    (taxas.proprios ?? []).map((m) => ({
      id: proxId.current++,
      nome: m.nome,
      chaveSalva: m.chave,
      percentual: paraTexto(m.regra.percentual),
      fixo: paraTexto(m.regra.fixo),
    })),
  );
  const freteGratisAntes = taxas.tiktok_shop?.freteGratis === true;
  const [freteGratis, setFreteGratis] = useState(freteGratisAntes);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ajudaId = useId();

  const formas = FORMAS_RECEBIMENTO.map((f) => ({ chave: f as ChaveTaxa, regra: lerRegra(rascunho[f]) }));
  const marketplaces = MARKETPLACES_COM_TAXA.map((m) => ({ chave: m as ChaveTaxa, regra: lerRegra(rascunho[m]) }));
  const comErro = [...formas, ...marketplaces].filter((r) => validarRegra(r.regra));

  // Marketplace próprio: nome obrigatório, sem repetir (nem com Shopee etc.).
  const chavesProprias = proprios.map((m) => chaveDoMarketplace(m.nome));
  const problemaDoProprio = (m: ProprioRascunho, i: number): "nome" | "repetido" | "regra" | null => {
    const chave = chavesProprias[i];
    if (!m.nome.trim() || !chave) return "nome";
    const nomeFixo = CHAVES_FIXAS.some((c) => ROTULO_TAXA[c].toLowerCase() === m.nome.trim().toLowerCase());
    if (nomeFixo || chavesProprias.indexOf(chave) !== i) return "repetido";
    if (validarRegra(lerRegra(m))) return "regra";
    return null;
  };
  const propriosComErro = proprios.filter((m, i) => problemaDoProprio(m, i));
  const temErro = comErro.length > 0 || propriosComErro.length > 0;

  const mudar = (c: ChaveTaxa, campo: keyof Campos, valor: string) =>
    setRascunho((atual) => ({ ...atual, [c]: { ...atual[c], [campo]: valor } }));
  const mudarProprio = (id: number, campo: "nome" | keyof Campos, valor: string) =>
    setProprios((lista) => lista.map((m) => (m.id === id ? { ...m, [campo]: valor } : m)));
  const adicionar = () =>
    setProprios((lista) => [...lista, { id: proxId.current++, nome: "", chaveSalva: null, percentual: "", fixo: "" }]);
  const tirar = (id: number) => setProprios((lista) => lista.filter((m) => m.id !== id));

  const salvar = async () => {
    if (temErro) return;
    setSalvando(true);
    setErro(null);
    const novas: TaxasDaConta = {};
    for (const { chave, regra } of formas) novas[chave] = regra;
    // Marketplace fixo só entra se ela preencheu ou se já existia: linha vazia
    // de Shopee pra quem não vende lá viraria "sem taxa" no lucro por canal.
    for (const { chave, regra } of marketplaces)
      if (preenchida(rascunho[chave]) || taxas[chave]) novas[chave] = regra;
    novas.proprios = proprios.map<MarketplaceProprio>((m, i) => ({
      chave: chavesProprias[i]!,
      nome: m.nome.trim().slice(0, MAX_NOME_MARKETPLACE),
      regra: lerRegra(m),
    }));
    const ficam = new Set(novas.proprios.map((m) => m.chave));
    const removidos = (taxas.proprios ?? []).map((m) => m.chave).filter((c) => !ficam.has(c));
    let { error } = await salvarTaxas(userId, novas, removidos);
    if (!error && freteGratis !== freteGratisAntes)
      ({ error } = await salvarFreteGratisTiktok(userId, freteGratis));
    setSalvando(false);
    if (error) {
      console.error("taxas_salvar", error);
      setErro("A Pólia One não conseguiu salvar as taxas agora. Tenta de novo.");
      return;
    }
    track("taxas_recebimento_salvas", {
      preenchidas: [...formas, ...marketplaces].filter((r) => r.regra.percentual || r.regra.fixo).length,
      marketplaces_proprios: novas.proprios.length,
    });
    onSaved();
  };

  const tiktokManual = preenchida(rascunho.tiktok_shop);

  return (
    <Modal
      open
      onOpenChange={(n) => !n && onClose()}
      title="Taxas de recebimento"
      description="Quanto a maquininha, o Pix, o link e os marketplaces levam de cada venda. A Pólia One usa pra preencher a taxa ao registrar uma venda e pra mostrar quanto cada canal deixa."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando || temErro} className={BTN_ACAO}>
            {salvando ? "Salvando…" : "Salvar taxas"}
          </button>
        </>
      }
    >
      <TabelaTaxas legenda="Taxa por forma de recebimento" titulo="Forma">
        {formas.map(({ chave, regra }) => (
          <LinhaTaxa
            key={chave}
            rotulo={ROTULO_TAXA[chave]}
            campos={rascunho[chave]}
            problema={validarRegra(regra)}
            ajudaId={ajudaId}
            onMudar={(campo, v) => mudar(chave, campo, v)}
          />
        ))}
      </TabelaTaxas>

      <section className="mt-6 border-t border-[var(--line)] pt-4" aria-labelledby={`${ajudaId}-mkt`}>
        <h3 id={`${ajudaId}-mkt`} className="text-[14px] font-medium text-[var(--ink)]">
          Marketplaces
        </h3>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Preencha o que cada um cobra por venda. Vende em outro lugar? Adicione o marketplace com o nome dele.
        </p>

        <div className="mt-2">
          <TabelaTaxas legenda="Taxa por marketplace" titulo="Marketplace">
            {marketplaces.map(({ chave, regra }) => (
              <LinhaTaxa
                key={chave}
                rotulo={ROTULO_TAXA[chave]}
                campos={rascunho[chave]}
                problema={validarRegra(regra)}
                ajudaId={ajudaId}
                onMudar={(campo, v) => mudar(chave, campo, v)}
                placeholder={chave === "tiktok_shop" ? "tabela" : "0"}
              />
            ))}
            {proprios.map((m, i) => {
              const problema = problemaDoProprio(m, i);
              const regra = lerRegra(m);
              return (
                <tr key={m.id} className="border-t border-[var(--line)]">
                  <th scope="row" className="py-2 pr-2 text-left font-normal">
                    <div className="flex items-center gap-1">
                      <input
                        value={m.nome}
                        onChange={(e) => mudarProprio(m.id, "nome", e.target.value)}
                        maxLength={MAX_NOME_MARKETPLACE}
                        placeholder="Nome, ex.: Elo7"
                        aria-label="Nome do marketplace"
                        aria-invalid={problema === "nome" || problema === "repetido"}
                        aria-describedby={problema ? ajudaId : undefined}
                        className={INPUT_NOME}
                        autoFocus={!m.chaveSalva && !m.nome}
                      />
                      <button
                        type="button"
                        onClick={() => tirar(m.id)}
                        aria-label={`Tirar ${m.nome.trim() || "o marketplace sem nome"}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--danger)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </th>
                  <CamposTaxa
                    rotulo={m.nome.trim() || "marketplace sem nome"}
                    campos={m}
                    problema={problema === "regra" ? validarRegra(regra) : null}
                    ajudaId={ajudaId}
                    onMudar={(campo, v) => mudarProprio(m.id, campo, v)}
                  />
                </tr>
              );
            })}
          </TabelaTaxas>
        </div>

        <button type="button" onClick={adicionar} className={`${BTN_MIUDO_ACAO} mt-3`}>
          <Plus size={14} aria-hidden="true" /> Adicionar marketplace
        </button>

        <div className="mt-4 rounded-lg bg-[var(--surface)] p-3">
          <p className="text-[13px] text-[var(--ink-soft)]">
            {tiktokManual
              ? "TikTok Shop: vale a taxa que você preencheu. Apague os dois campos pra voltar à tarifa oficial."
              : `TikTok Shop em branco: a Pólia One usa a tarifa oficial do TikTok, por item: ${descreverTabelaTiktok()}.`}
          </p>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-[14px] text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={freteGratis}
              onChange={(e) => setFreteGratis(e.target.checked)}
              disabled={tiktokManual}
              className="h-4 w-4 accent-[var(--secondary-text)]"
            />
            Participo do Programa de Frete Grátis do TikTok (mais 6% por item, até R$ 50, na tarifa oficial)
          </label>
        </div>
      </section>

      <p id={ajudaId} aria-live="polite" className="mt-3 text-[13px] text-[var(--muted)]">
        {comErro.length > 0
          ? `Confira ${comErro.map((r) => ROTULO_TAXA[r.chave]).join(", ")}: use só número, com até 2 casas depois da vírgula, de 0 a 100 no percentual e de 0 a 100.000 no valor fixo.`
          : propriosComErro.length > 0
            ? "Confira os marketplaces que você adicionou: cada um precisa de um nome que não se repita, e a taxa vai só em número, de 0 a 100 no percentual."
            : "Deixe em branco a forma que não cobra nada. Os valores ficam no extrato, no app da maquininha ou no painel do marketplace."}
      </p>
      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}

function TabelaTaxas({ legenda, titulo, children }: { legenda: string; titulo: string; children: React.ReactNode }) {
  return (
    <table className="w-full text-[14px]">
      <caption className="sr-only">{legenda}</caption>
      <thead>
        <tr className="text-left text-[12px] text-[var(--muted)]">
          <th scope="col" className="pb-2 font-normal">
            {titulo}
          </th>
          <th scope="col" className="w-24 pb-2 text-right font-normal">
            % da venda
          </th>
          <th scope="col" className="w-28 pb-2 pl-2 text-right font-normal">
            + R$ por venda
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function LinhaTaxa(p: {
  rotulo: string;
  campos: Campos;
  problema: ReturnType<typeof validarRegra>;
  ajudaId: string;
  onMudar: (campo: keyof Campos, valor: string) => void;
  placeholder?: string;
}) {
  return (
    <tr className="border-t border-[var(--line)]">
      <th scope="row" className="py-2 pr-2 text-left font-normal text-[var(--ink-soft)]">
        {p.rotulo}
      </th>
      <CamposTaxa {...p} />
    </tr>
  );
}

function CamposTaxa({
  rotulo,
  campos,
  problema,
  ajudaId,
  onMudar,
  placeholder = "0",
}: {
  rotulo: string;
  campos: Campos;
  problema: ReturnType<typeof validarRegra>;
  ajudaId: string;
  onMudar: (campo: keyof Campos, valor: string) => void;
  placeholder?: string;
}) {
  return (
    <>
      <td className="py-2">
        <input
          inputMode="decimal"
          value={campos.percentual}
          onChange={(e) => onMudar("percentual", e.target.value)}
          aria-label={`Percentual da taxa: ${rotulo}`}
          aria-invalid={problema === "percentual_invalido"}
          aria-describedby={problema === "percentual_invalido" ? ajudaId : undefined}
          placeholder={placeholder}
          className={INPUT}
        />
      </td>
      <td className="py-2 pl-2">
        <input
          inputMode="decimal"
          value={campos.fixo}
          onChange={(e) => onMudar("fixo", e.target.value)}
          aria-label={`Valor fixo por venda: ${rotulo}`}
          aria-invalid={problema === "fixo_invalido"}
          aria-describedby={problema === "fixo_invalido" ? ajudaId : undefined}
          placeholder={placeholder}
          className={INPUT}
        />
      </td>
    </>
  );
}
