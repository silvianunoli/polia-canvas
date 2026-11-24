import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
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
  useCategoriasDaVitrine,
  useCuponsDaVitrine,
  useProdutosDoCatalogo,
  type AlcanceDoCupom,
  type CupomDaVitrine,
  type TipoDoCupom,
} from "@/components/catalogo/dados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]";
const BTN_SETA =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--secondary-text)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)] disabled:opacity-40 disabled:pointer-events-none";
const CHIP =
  "min-h-9 rounded-full border px-3 py-1 font-sans text-[13px] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]";
const CHIP_LIGADO = "border-[var(--secondary-text)] bg-[var(--secondary-light)] text-[var(--ink)]";
const CHIP_DESLIGADO = "border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)] hover:border-[var(--secondary-text)]";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeDaCidade = (c: string) => `${c.slice(3)} (${c.slice(0, 2)})`;

/**
 * Cupons de desconto (24/11/2026, ONE-239, desenho aprovado pela Sil). Cada
 * cupom salva na hora, como as cores, sem passar pela barra "Salvar a loja".
 * Cupom usado não se apaga, só desliga: o pedido antigo mostra o código.
 *
 * Os cupons são da conta: o mesmo código vale na Vitrine online e na Loja da
 * marca, com um só contador de usos. Por isso a seção aparece nas duas telas.
 *
 * Regras (24/11/2026, pedido da Sil): o desconto pode valer só numa categoria,
 * numa coleção ou em produtos escolhidos, e só no Pix ou só no cartão; o cupom
 * pode ser de frete grátis, para o Brasil todo ou para estados e cidades.
 * Pix, cartão e frete grátis só existem na loja da marca: a Vitrine online não
 * cobra nem calcula frete, então lá o cupom é recusado (decisão da Sil).
 */
export function CuponsDeDesconto({ userId, texto }: { userId: string; texto: string }) {
  const qc = useQueryClient();
  const q = useCuponsDaVitrine(userId);
  const categorias = useCategoriasDaVitrine(userId);
  const [alcance, setAlcance] = useState<AlcanceDoCupom>("todos");
  // A lista de produtos só carrega quando a dona vai escolher produtos.
  const produtos = useProdutosDoCatalogo(userId, alcance === "produtos");
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<TipoDoCupom>("percentual");
  const [valor, setValor] = useState("");
  const [validoAte, setValidoAte] = useState("");
  const [limite, setLimite] = useState("");
  const [grupo, setGrupo] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [meio, setMeio] = useState<"" | "pix" | "cartao">("");
  const [ufs, setUfs] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidade, setCidade] = useState("");
  const [ufDaCidade, setUfDaCidade] = useState("SP");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const recarregar = () => qc.invalidateQueries({ queryKey: [CHAVE_CUPONS_CATALOGO, userId] });
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const frete = tipo === "frete_gratis";

  const nomeDoGrupo = useMemo(() => new Map((categorias.data ?? []).map((c) => [c.id, c.nome])), [categorias.data]);
  const daLoja = useMemo(() => (produtos.data ?? []).filter((p) => p.noCatalogo), [produtos.data]);
  const grupos = (categorias.data ?? []).filter((c) => c.tipo === (alcance === "colecao" ? "colecao" : "categoria"));
  const achados = busca.trim()
    ? daLoja.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : daLoja;

  const limparFormulario = () => {
    setCodigo("");
    setValor("");
    setValidoAte("");
    setLimite("");
    setAlcance("todos");
    setGrupo("");
    setEscolhidos([]);
    setBusca("");
    setMeio("");
    setUfs([]);
    setCidades([]);
    setCidade("");
  };

  const porCidade = () => {
    const nome = cidade.trim().replace(/\s+/g, " ").replace(/:/g, "");
    if (nome.length < 2) return setErro("Escreva o nome da cidade.");
    const nova = `${ufDaCidade}:${nome.slice(0, 60)}`;
    if (!cidades.some((c) => c.toLowerCase() === nova.toLowerCase())) setCidades([...cidades, nova].slice(0, 50));
    setCidade("");
    setErro(null);
  };

  const criar = async () => {
    const alcanceIds = frete || alcance === "todos" ? [] : alcance === "produtos" ? escolhidos : grupo ? [grupo] : [];
    const novo = {
      codigo: normalizarCodigoCupom(codigo),
      tipo,
      valor: frete ? null : Number(valor.replace(",", ".")),
      validoAte: validoAte || null,
      limiteUsos: limite.trim() ? Number(limite) : null,
      alcance: frete ? ("todos" as const) : alcance,
      alcanceIds,
      meio: frete || !meio ? null : meio,
      ufs: frete ? ufs : [],
      cidades: frete ? cidades : [],
    };
    const problema = problemaDoCupomNovo(novo);
    if (problema) return setErro(problema);
    setOcupado(true);
    setErro(null);
    const r = await criarCupom(userId, novo);
    setOcupado(false);
    if (r.error) return setErro(r.error);
    limparFormulario();
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

  /** "10% de desconto em Canecas, só no Pix" ou "Frete grátis para SP e Niterói (RJ)". */
  const regra = (c: CupomDaVitrine) => {
    if (c.tipo === "frete_gratis") {
      const lugares = [...c.ufs, ...c.cidades.map(nomeDaCidade)];
      return lugares.length ? `Frete grátis para ${lugares.join(", ")}` : "Frete grátis para o Brasil todo";
    }
    const quanto = c.tipo === "percentual" ? `${String(c.valor).replace(".", ",")}%` : brl(c.valor ?? 0);
    const onde =
      c.alcance === "produtos"
        ? ` em ${c.alcanceIds.length} ${c.alcanceIds.length === 1 ? "produto" : "produtos"}`
        : c.alcance === "todos"
          ? ""
          : ` em ${c.alcanceIds.map((id) => nomeDoGrupo.get(id) ?? (c.alcance === "colecao" ? "uma coleção" : "uma categoria")).join(", ")}`;
    const pagamento = c.meio === "pix" ? ", só no Pix" : c.meio === "cartao" ? ", só no cartão" : "";
    return `${quanto} de desconto${onde}${pagamento}`;
  };
  const soNaLoja = (c: CupomDaVitrine) => c.tipo === "frete_gratis" || c.meio !== null;
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
                    {regra(c)} · {c.validoAte ? `vale até ${data(c.validoAte)}` : "sem data"} · {usos}
                    {venceu ? " · venceu" : esgotou ? " · esgotou" : ""}
                  </p>
                  {soNaLoja(c) && <p className="font-sans text-[12px] text-[var(--muted)]">Vale só na loja da marca, não na Vitrine online.</p>}
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
          <Campo label="O que o cupom dá">
            <select className={INPUT} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDoCupom)}>
              <option value="percentual">Desconto em porcentagem (%)</option>
              <option value="valor">Desconto em reais (R$)</option>
              <option value="frete_gratis">Frete grátis</option>
            </select>
          </Campo>
          {!frete && (
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
          )}
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

        {!frete ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Vale para">
              <select
                className={INPUT}
                value={alcance}
                onChange={(e) => {
                  setAlcance(e.target.value as AlcanceDoCupom);
                  setGrupo("");
                }}
              >
                <option value="todos">Todos os produtos</option>
                <option value="categoria">Uma categoria</option>
                <option value="colecao">Uma coleção</option>
                <option value="produtos">Produtos escolhidos</option>
              </select>
            </Campo>
            {(alcance === "categoria" || alcance === "colecao") && (
              <Campo
                label={alcance === "colecao" ? "Coleção" : "Categoria"}
                hint={grupos.length ? undefined : `Nenhuma ${alcance === "colecao" ? "coleção" : "categoria"} criada ainda.`}
              >
                <select className={INPUT} value={grupo} onChange={(e) => setGrupo(e.target.value)} disabled={!grupos.length}>
                  <option value="">Escolha</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo label="Forma de pagamento" hint="Pix e cartão valem só na loja da marca.">
              <select className={INPUT} value={meio} onChange={(e) => setMeio(e.target.value as "" | "pix" | "cartao")}>
                <option value="">Qualquer forma</option>
                <option value="pix">Só no Pix</option>
                <option value="cartao">Só no cartão</option>
              </select>
            </Campo>
            {alcance === "produtos" && (
              <fieldset className="sm:col-span-2 lg:col-span-3">
                <legend className="mb-2 font-sans text-[14px] font-medium text-[var(--ink)]">
                  Produtos do cupom{escolhidos.length ? ` (${escolhidos.length})` : ""}
                </legend>
                {produtos.isError ? (
                  <BlockError message="A Pólia One não conseguiu abrir os produtos agora." onRetry={() => produtos.refetch()} />
                ) : produtos.isLoading ? (
                  <div className="h-24 animate-pulse rounded-lg bg-[var(--bg)] motion-reduce:animate-none" />
                ) : daLoja.length ? (
                  <>
                    <input
                      className={`${INPUT} mb-2`}
                      type="search"
                      placeholder="Buscar produto"
                      aria-label="Buscar produto"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                    <ul className="max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--bg)]">
                      {achados.map((p) => (
                        <li key={p.id}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 font-sans text-[14px] text-[var(--ink)] hover:bg-[var(--surface)]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--secondary-text)]"
                              checked={escolhidos.includes(p.id)}
                              onChange={(e) =>
                                setEscolhidos(e.target.checked ? [...escolhidos, p.id] : escolhidos.filter((x) => x !== p.id))
                              }
                            />
                            <span className="flex-1">{p.nome}</span>
                            <span className="text-[13px] text-[var(--ink-soft)]">{brl(p.preco)}</span>
                          </label>
                        </li>
                      ))}
                      {!achados.length && <li className="px-3 py-3 font-sans text-[13px] text-[var(--ink-soft)]">Nenhum produto com esse nome.</li>}
                    </ul>
                  </>
                ) : (
                  <p className="font-sans text-[13px] text-[var(--ink-soft)]">Nenhum produto na loja ainda.</p>
                )}
              </fieldset>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="font-sans text-[13px] text-[var(--ink-soft)]">
              Frete grátis vale só na loja da marca, que calcula o frete. Sem estado nem cidade marcados, vale para o Brasil todo. A
              etiqueta continua por conta da marca.
            </p>
            <fieldset>
              <legend className="mb-2 font-sans text-[14px] font-medium text-[var(--ink)]">Estados</legend>
              <div className="flex flex-wrap gap-2">
                {UFS.map((uf) => {
                  const ligado = ufs.includes(uf);
                  return (
                    <button
                      key={uf}
                      type="button"
                      aria-pressed={ligado}
                      className={`${CHIP} ${ligado ? CHIP_LIGADO : CHIP_DESLIGADO}`}
                      onClick={() => setUfs(ligado ? ufs.filter((x) => x !== uf) : [...ufs, uf])}
                    >
                      {uf}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 font-sans text-[14px] font-medium text-[var(--ink)]">Cidades</legend>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  className={`${INPUT} max-w-[260px]`}
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      porCidade();
                    }
                  }}
                  placeholder="Ex.: São Paulo"
                  aria-label="Nome da cidade"
                  maxLength={60}
                />
                <select className={`${INPUT} w-[88px]`} value={ufDaCidade} onChange={(e) => setUfDaCidade(e.target.value)} aria-label="Estado da cidade">
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                <button type="button" className={BTN_MIUDO} onClick={porCidade}>
                  Pôr a cidade
                </button>
              </div>
              {cidades.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Cidades com frete grátis">
                  {cidades.map((c) => (
                    <li key={c} className={`${CHIP} ${CHIP_LIGADO} flex items-center gap-1`}>
                      {nomeDaCidade(c)}
                      <button
                        type="button"
                        className="rounded-full p-1 focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]"
                        onClick={() => setCidades(cidades.filter((x) => x !== c))}
                        aria-label={`Tirar ${nomeDaCidade(c)}`}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </div>
        )}

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
