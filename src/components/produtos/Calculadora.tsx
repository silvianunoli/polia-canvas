import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { hojeISO } from "@/lib/data.functions";
import { Link } from "@tanstack/react-router";
import { Lock, Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";
import { toastErro } from "@/lib/toast";
import {
  calcularQuantoSobra,
  calcularPrecoSugerido,
  calcularTaxas,
  calcularEncomenda,
  calcularRateio,
  maoDeObraPorPeca,
  simularDesconto,
  type CalculadoraBreakdown,
} from "@/lib/precificacao.functions";
import {
  ITENS_CUSTO_FIXO,
  PREFIXO_FIXO,
  somarCustosFixos,
  type ChaveCustoFixo,
} from "@/lib/custosFixos.functions";
import { BlocoCustosFixos, type DetalheFixos } from "./BlocoCustosFixos";
import { BlocoInsumos, BlocoMaoDeObra } from "./BlocoInsumos";
import { totalDosInsumos, type ItemInsumo } from "./insumos";
import { vendasParaFaturar } from "@/lib/projecao.functions";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO } from "@/lib/botoes";
import { fmt, num, numInvalido, type Prefill, type Produto } from "./tipos";

type PerfilCalc = "produto" | "servico" | "encomenda";

interface ItemMaterial {
  id: string;
  nome: string;
  quantidade: string;
  custoUnitario: string;
}
interface ItemExtra {
  id: string;
  descricao: string;
  valor: string;
}

function novoId(): string {
  return crypto.randomUUID();
}

function parseItens<T>(json: string): T[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function Calculadora({
  onSalvarComoProduto,
  salvarBloqueado,
  metaBoa,
  userId,
  ehProjete,
  valorHoraPadrao,
  valorHoraPadraoCarregando,
  produtoRecalcular,
  onCancelarRecalculo,
  onAtualizado,
  fixosDoFinanceiro = null,
}: {
  onSalvarComoProduto: (pf: Prefill) => void;
  /** Cota do catálogo cheia: calcular segue livre, só o "Salvar como produto" fecha. */
  salvarBloqueado?: boolean;
  metaBoa: number | null;
  userId?: string;
  ehProjete: boolean;
  valorHoraPadrao: number | null;
  valorHoraPadraoCarregando: boolean;
  produtoRecalcular?: Produto | null;
  onCancelarRecalculo?: () => void;
  onAtualizado?: () => void;
  /** Saídas fixas do mês corrente no Financeiro, por item (null = sem dado). */
  fixosDoFinanceiro?: Record<ChaveCustoFixo, number> | null;
}) {
  const bk = produtoRecalcular?.calculadora_breakdown ?? null;
  const v = (campo: string) => bk?.valores?.[campo] ?? "";

  const [perfil, setPerfil] = useState<PerfilCalc>(
    bk?.perfil ?? (produtoRecalcular?.tipo === "servico" ? "servico" : "produto"),
  );

  // ── Perfil Produto ──
  const [materiaPrima, setMateriaPrima] = useState(() => v("materiaPrima"));
  const [embalagem, setEmbalagem] = useState(() => v("embalagem"));
  const [maoObra, setMaoObra] = useState(() => v("maoObra"));
  const [outrosDiretos, setOutrosDiretos] = useState(() => v("outrosDiretos"));
  // Detalhamento do custo direto (09/10/2026): matéria-prima e embalagem pelo
  // pacote, mão de obra pelo tempo. Detalhado, o campo de total vira a conta.
  const [mpDetalhada, setMpDetalhada] = useState(() => v("materiaPrimaDetalhada") === "1");
  const [itensMp, setItensMp] = useState<ItemInsumo[]>(() =>
    parseItens<ItemInsumo>(v("itensMateriaPrima") || "[]"),
  );
  const [embDetalhada, setEmbDetalhada] = useState(() => v("embalagemDetalhada") === "1");
  const [itensEmb, setItensEmb] = useState<ItemInsumo[]>(() =>
    parseItens<ItemInsumo>(v("itensEmbalagem") || "[]"),
  );
  const [maoObraDetalhada, setMaoObraDetalhada] = useState(() => v("maoObraDetalhada") === "1");
  const [minutosPorPeca, setMinutosPorPeca] = useState(() => v("minutosPorPeca"));
  const [qtd, setQtd] = useState(() => v("qtd"));
  const [proLabore, setProLabore] = useState(() => v("proLabore"));
  const [taxaVenda, setTaxaVenda] = useState(() => v("taxaVenda"));
  const [impostos, setImpostos] = useState(() => v("impostos"));
  const [margem, setMargem] = useState(() => v("margem"));

  // ── Perfil Serviço ──
  const [valorHora, setValorHora] = useState(() => v("valorHora"));
  const [horas, setHoras] = useState(() => v("horas"));
  const [materiais, setMateriais] = useState(() => v("materiais"));
  const [deslocamento, setDeslocamento] = useState(() => v("deslocamento"));
  const [ferramentas, setFerramentas] = useState(() => v("ferramentas"));
  const [outrosServico, setOutrosServico] = useState(() => v("outrosServico"));
  const [taxaVendaS, setTaxaVendaS] = useState(() => v("taxaVendaS"));
  const [impostosS, setImpostosS] = useState(() => v("impostosS"));
  const [margemSeg, setMargemSeg] = useState(() => v("margemSeg"));
  const [qtdServicos, setQtdServicos] = useState(() => v("qtdServicos"));

  // ── Custos fixos do mês (Produto e Serviço) ──
  // Mesmo estado nas duas abas, como o valor-hora: o aluguel é o mesmo,
  // vendendo peça ou serviço. Detalhado, o total é a soma dos itens.
  const [despesasFixas, setDespesasFixas] = useState(() => v("despesasFixas"));
  const [fixosDetalhado, setFixosDetalhado] = useState(() => v("fixosDetalhado") === "1");
  const [fixosDetalhe, setFixosDetalhe] = useState<DetalheFixos>(() =>
    Object.fromEntries(
      ITENS_CUSTO_FIXO.map((i) => [i.chave, v(PREFIXO_FIXO + i.chave)]).filter(([, x]) => x),
    ),
  );
  const fixosMes = fixosDetalhado ? somarCustosFixos(fixosDetalhe) : num(despesasFixas);
  const materiaPrimaVal = mpDetalhada ? totalDosInsumos(itensMp) : num(materiaPrima);
  const embalagemVal = embDetalhada ? totalDosInsumos(itensEmb) : num(embalagem);
  const maoObraVal = maoObraDetalhada
    ? maoDeObraPorPeca(num(minutosPorPeca), num(valorHora))
    : num(maoObra);

  // ── Perfil Encomenda (Pro) ──
  // valorHora/horas são os MESMOS estados do perfil Serviço acima (de propósito:
  // trocar de aba não perde o que já foi digitado, e "puxar o valor-hora do
  // modo serviço" já acontece de graça por ser o mesmo estado).
  const [itensMaterial, setItensMaterial] = useState<ItemMaterial[]>(() =>
    bk?.perfil === "encomenda" ? parseItens<ItemMaterial>(v("itensMaterial") || "[]") : [],
  );
  const [itensExtras, setItensExtras] = useState<ItemExtra[]>(() =>
    bk?.perfil === "encomenda" ? parseItens<ItemExtra>(v("itensExtras") || "[]") : [],
  );
  const [taxaVendaE, setTaxaVendaE] = useState(() => v("taxaVendaE"));
  const [impostosE, setImpostosE] = useState(() => v("impostosE"));
  const [quantoSobraPct, setQuantoSobraPct] = useState(() => v("quantoSobraPct"));
  const [valorHoraSalvo, setValorHoraSalvo] = useState(false);
  const [salvandoValorHora, setSalvandoValorHora] = useState(false);
  const valorHoraFocusRef = useRef<HTMLInputElement>(null);

  // Preenche o valor-hora com o padrão salvo assim que ele carrega, só se o
  // campo ainda estiver vazio (nunca sobrescreve o que veio do breakdown ou
  // o que ela já digitou nesta sessão).
  useEffect(() => {
    if (valorHoraPadrao != null && !valorHora) {
      setValorHora(String(valorHoraPadrao));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorHoraPadrao]);

  // Antes o erro era ignorado e a tela dizia "salvo" do mesmo jeito.
  const salvarValorHoraPadrao = async () => {
    if (!userId || num(valorHora) <= 0 || salvandoValorHora) return;
    setSalvandoValorHora(true);
    const { error } = await supabase
      .from("profiles")
      .update({ valor_hora_padrao: num(valorHora) })
      .eq("id", userId);
    setSalvandoValorHora(false);
    if (error) {
      console.error("valor_hora_padrao_salvar", error);
      toastErro("A Pólia One não conseguiu salvar o valor-hora padrão. Tenta de novo.");
      return;
    }
    setValorHoraSalvo(true);
    setTimeout(() => setValorHoraSalvo(false), 1600);
  };

  // ── Simulador de desconto ──
  const [desconto, setDesconto] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fórmula "preço por dentro": taxa, imposto e lucro são % do PREÇO final,
  // então o preço = custo / (1 − soma_dos_percentuais/100).
  const produtoCalc = useMemo(() => {
    const custoDireto = materiaPrimaVal + embalagemVal + maoObraVal + num(outrosDiretos);
    const rateioFixos = calcularRateio({ custosFixosMes: fixosMes, qtdMes: num(qtd) });
    const rateioSalario = calcularRateio({
      custosFixosMes: 0,
      proLaboreMes: num(proLabore),
      qtdMes: num(qtd),
    });
    const custoUnitario = custoDireto + rateioFixos + rateioSalario;
    const taxaVendaPct = num(taxaVenda);
    const impostosPct = num(impostos);
    const pctVenda = taxaVendaPct + impostosPct;
    const pctTotal = pctVenda + num(margem);
    const invalido = pctTotal >= 100;
    const precoMinimo = calcularPrecoSugerido(custoUnitario, pctVenda);
    const precoSugerido = calcularPrecoSugerido(custoUnitario, pctTotal);
    const sobraInput = {
      precoVenda: precoSugerido,
      precoCusto: custoUnitario,
      taxaVendaPct,
      impostosPct,
    };
    const taxasReais = calcularTaxas(sobraInput);
    const lucroReais = calcularQuantoSobra(sobraInput);
    return {
      custoDireto,
      rateioFixos,
      rateioSalario,
      custoUnitario,
      precoMinimo,
      precoSugerido,
      taxasReais,
      lucroReais,
      invalido,
    };
  }, [
    materiaPrimaVal,
    embalagemVal,
    maoObraVal,
    outrosDiretos,
    fixosMes,
    proLabore,
    qtd,
    taxaVenda,
    impostos,
    margem,
  ]);

  const servicoCalc = useMemo(() => {
    const maoDeObra = num(valorHora) * num(horas);
    const custosProjeto =
      num(materiais) + num(deslocamento) + num(ferramentas) + num(outrosServico);
    const rateioFixos = calcularRateio({ custosFixosMes: fixosMes, qtdMes: num(qtdServicos) });
    const custoTotal = maoDeObra + custosProjeto + rateioFixos;
    const taxaVendaPct = num(taxaVendaS);
    const impostosPct = num(impostosS);
    const pctVenda = taxaVendaPct + impostosPct;
    const pctTotal = pctVenda + num(margemSeg);
    const invalido = pctTotal >= 100;
    const precoSugerido = calcularPrecoSugerido(custoTotal, pctTotal);
    const sobraInput = {
      precoVenda: precoSugerido,
      precoCusto: custoTotal,
      taxaVendaPct,
      impostosPct,
    };
    const taxasReais = calcularTaxas(sobraInput);
    const lucroReais = calcularQuantoSobra(sobraInput);
    return {
      maoDeObra,
      custosProjeto,
      rateioFixos,
      custoTotal,
      precoSugerido,
      taxasReais,
      lucroReais,
      invalido,
    };
  }, [
    valorHora,
    horas,
    materiais,
    deslocamento,
    ferramentas,
    outrosServico,
    fixosMes,
    qtdServicos,
    taxaVendaS,
    impostosS,
    margemSeg,
  ]);

  const encomendaCalc = useMemo(
    () =>
      calcularEncomenda({
        itensMaterial: itensMaterial.map((it) => ({
          quantidade: num(it.quantidade),
          custoUnitario: num(it.custoUnitario),
        })),
        horas: num(horas),
        valorHora: num(valorHora),
        itensExtras: itensExtras.map((it) => ({ valor: num(it.valor) })),
        taxaVendaPct: num(taxaVendaE),
        impostosPct: num(impostosE),
        quantoSobraPct: num(quantoSobraPct),
      }),
    [itensMaterial, horas, valorHora, itensExtras, taxaVendaE, impostosE, quantoSobraPct],
  );

  const calc =
    perfil === "produto" ? produtoCalc : perfil === "servico" ? servicoCalc : encomendaCalc;
  const custoBase =
    perfil === "produto"
      ? produtoCalc.custoUnitario
      : perfil === "servico"
        ? servicoCalc.custoTotal
        : encomendaCalc.custoTotal;
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const lucroPorVenda = round2(calc.lucroReais);
  // Meta do mês é o que precisa ENTRAR (Painel e Financeiro medem entradas /
  // meta), então divide pelo preço, na mesma conta da Projeção. Antes dividia
  // pela sobra: caderno a R$ 49 com sobra de R$ 19,60 e meta de R$ 3.000 dava
  // 154 aqui e 62 na Projeção. Continua escondida quando a venda não deixa
  // sobra (o aviso de preço abaixo do piso já aparece).
  const precoParaMeta = round2(calc.precoSugerido);
  const vendasParaMetaBoa =
    lucroPorVenda > 0 && metaBoa ? vendasParaFaturar(metaBoa, precoParaMeta) : null;
  const taxaVendaPctAtual =
    perfil === "produto"
      ? num(taxaVenda)
      : perfil === "servico"
        ? num(taxaVendaS)
        : num(taxaVendaE);
  const impostosPctAtual =
    perfil === "produto" ? num(impostos) : perfil === "servico" ? num(impostosS) : num(impostosE);

  // Estados específicos do modo Encomenda (PRD): vazio, parcial (sem
  // valor-hora com horas lançadas) e erro de negócio (preço abaixo do piso).
  const encomendaVazia =
    perfil === "encomenda" &&
    itensMaterial.length === 0 &&
    itensExtras.length === 0 &&
    num(horas) <= 0;
  const encomendaSemValorHora = perfil === "encomenda" && num(horas) > 0 && num(valorHora) <= 0;
  const encomendaAbaixoDoPiso =
    perfil === "encomenda" && !encomendaVazia && num(quantoSobraPct) < 0;

  // Preço abaixo do piso nos perfis Produto e Serviço (sobra pedida negativa):
  // a Encomenda já avisava, os outros dois mostravam "Seu lucro" negativo calado.
  const abaixoDoPisoProdutoServico =
    perfil !== "encomenda" && !calc.invalido && round2(calc.lucroReais) < 0;
  const pisoAtual = calcularPrecoSugerido(custoBase, taxaVendaPctAtual + impostosPctAtual);

  // Salvar com as porcentagens em 100% ou mais gravava o próprio custo como
  // preço de venda (calcularPrecoSugerido cai pro custo nesse caso). Preço
  // zerado também não vira produto nem substitui o preço de um existente.
  const precoNaoSalvavel = calc.invalido || round2(calc.precoSugerido) <= 0;

  // Com desconto de X%: taxa/imposto são % do preço, então caem junto com ele.
  // Conta em simularDesconto (precificacao.functions.ts): com 100% ou mais o
  // preço vai a zero e o custo continua saindo, então aparece o prejuízo.
  const descontoPct = num(desconto);
  const simulacaoDesconto = useMemo(() => {
    const s = simularDesconto({
      precoVenda: calc.precoSugerido,
      precoCusto: custoBase,
      taxaVendaPct: taxaVendaPctAtual,
      impostosPct: impostosPctAtual,
      descontoPct,
    });
    return s
      ? { precoComDesconto: s.precoComDesconto, lucroComDesconto: s.sobra, prejuizo: s.prejuizo }
      : null;
  }, [descontoPct, calc.precoSugerido, custoBase, taxaVendaPctAtual, impostosPctAtual]);

  // despesasFixas guarda sempre o total que entrou na conta (lido por
  // rateioDoBreakdown); os itens só vão quando ela detalhou.
  function fixosParaBreakdown(): Record<string, string> {
    const r: Record<string, string> = {
      despesasFixas: fixosDetalhado ? String(Math.round(fixosMes * 100) / 100) : despesasFixas,
    };
    if (fixosDetalhado) {
      r.fixosDetalhado = "1";
      for (const i of ITENS_CUSTO_FIXO) {
        const x = fixosDetalhe[i.chave];
        if (x) r[PREFIXO_FIXO + i.chave] = x;
      }
    }
    return r;
  }

  // Custo direto detalhado: o total efetivo vai nas chaves de sempre
  // (materiaPrima/embalagem/maoObra, lidas por custoDiretoDoProduto) com 4
  // casas, pra soma bater com o preco_custo salvo; os detalhes vão junto.
  const comoTexto = (n: number) => String(Math.round(n * 10000) / 10000);
  function diretosParaBreakdown(): Record<string, string> {
    const r: Record<string, string> = {
      materiaPrima: mpDetalhada ? comoTexto(materiaPrimaVal) : materiaPrima,
      embalagem: embDetalhada ? comoTexto(embalagemVal) : embalagem,
      maoObra: maoObraDetalhada ? comoTexto(maoObraVal) : maoObra,
    };
    if (mpDetalhada) {
      r.materiaPrimaDetalhada = "1";
      r.itensMateriaPrima = JSON.stringify(itensMp);
    }
    if (embDetalhada) {
      r.embalagemDetalhada = "1";
      r.itensEmbalagem = JSON.stringify(itensEmb);
    }
    if (maoObraDetalhada) {
      r.maoObraDetalhada = "1";
      r.minutosPorPeca = minutosPorPeca;
      r.valorHora = valorHora;
    }
    return r;
  }

  function buildBreakdown(): CalculadoraBreakdown {
    if (perfil === "produto") {
      return {
        perfil,
        valores: {
          ...diretosParaBreakdown(),
          outrosDiretos,
          ...fixosParaBreakdown(),
          proLabore,
          qtd,
          taxaVenda,
          impostos,
          margem,
        },
      };
    }
    if (perfil === "encomenda") {
      return {
        perfil,
        valores: {
          itensMaterial: JSON.stringify(itensMaterial),
          valorHora,
          horas,
          itensExtras: JSON.stringify(itensExtras),
          taxaVendaE,
          impostosE,
          quantoSobraPct,
        },
      };
    }
    return {
      perfil,
      valores: {
        valorHora,
        horas,
        materiais,
        deslocamento,
        ferramentas,
        outrosServico,
        ...fixosParaBreakdown(),
        qtdServicos,
        taxaVendaS,
        impostosS,
        margemSeg,
      },
    };
  }

  const salvar = async () => {
    if (precoNaoSalvavel) return;
    const precoVenda = round2(calc.precoSugerido);
    const precoCusto = round2(custoBase) || undefined;
    const breakdown = buildBreakdown();

    if (!produtoRecalcular) {
      onSalvarComoProduto({
        nome: "",
        tipo: perfil === "produto" ? "fisico" : perfil === "encomenda" ? "fisico" : "servico",
        preco_venda: precoVenda,
        preco_custo: precoCusto,
        calculadora_breakdown: breakdown,
      });
      return;
    }

    // Recalculando: atualiza o mesmo produto direto, sem passar pelo modal.
    setSalvando(true);
    setErro(null);
    const update: Record<string, unknown> = {
      preco_venda: precoVenda,
      preco_custo: precoCusto ?? null,
      calculadora_breakdown: breakdown,
      updated_at: new Date().toISOString(),
    };
    if (Number(produtoRecalcular.preco_venda) !== precoVenda) {
      const atual = Array.isArray(produtoRecalcular.historico_precos)
        ? produtoRecalcular.historico_precos
        : [];
      update.historico_precos = [
        { preco: Number(produtoRecalcular.preco_venda), data: hojeISO() },
        ...atual,
      ] as unknown as Json;
      update.preco_atualizado_em = new Date().toISOString();
    }
    const { error } = await supabase
      .from("produtos")
      .update(update as never)
      .eq("id", produtoRecalcular.id);
    setSalvando(false);
    if (error) {
      console.error("produto_recalcular_preco", error);
      setErro("A Pólia One não conseguiu atualizar o preço. Tenta de novo.");
      return;
    }
    track("produto_preco_recalculado");
    onAtualizado?.();
  };

  // Valor da sua hora: o MESMO estado em Produto (mão de obra pelo tempo),
  // Serviço e Encomenda. Desde 09/10/2026 o "usar como meu valor-hora padrão"
  // aparece nos três e em todo plano (antes só na Encomenda, Pro).
  const campoValorHora = (onde: PerfilCalc, dica?: string) => {
    const id = `calc-valor-hora-${onde}`;
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[var(--ink-soft)]">
          Valor da sua hora (R$)
        </label>
        <input
          id={id}
          ref={onde === "encomenda" ? valorHoraFocusRef : undefined}
          type="number"
          inputMode="decimal"
          value={valorHora}
          onChange={(e) => setValorHora(e.target.value)}
          disabled={valorHoraPadraoCarregando && !valorHora}
          aria-describedby={dica ? `${id}-dica` : undefined}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none disabled:bg-[var(--surface)]"
          placeholder={valorHoraPadraoCarregando && !valorHora ? "carregando..." : "0"}
        />
        {dica && (
          <p id={`${id}-dica`} className="mt-1.5 text-[12.5px] text-[var(--muted)]">
            {dica}
          </p>
        )}
        {userId && num(valorHora) > 0 && num(valorHora) !== valorHoraPadrao && (
          <button
            type="button"
            onClick={() => void salvarValorHoraPadrao()}
            disabled={salvandoValorHora}
            className="inline-flex min-h-11 items-center text-[12px] font-medium text-[var(--secondary-text)] hover:underline disabled:cursor-wait disabled:opacity-60"
          >
            {salvandoValorHora
              ? "salvando..."
              : valorHoraSalvo
                ? "valor-hora padrão salvo"
                : "usar como meu valor-hora padrão"}
          </button>
        )}
      </div>
    );
  };

  const abasDisponiveis: PerfilCalc[] = ehProjete
    ? ["produto", "servico", "encomenda"]
    : ["produto", "servico"];
  const aoTeclarNasAbas = (e: KeyboardEvent<HTMLDivElement>) => {
    const atual = abasDisponiveis.indexOf(perfil);
    const ultimo = abasDisponiveis.length - 1;
    const proximo =
      e.key === "ArrowRight"
        ? (atual + 1) % abasDisponiveis.length
        : e.key === "ArrowLeft"
          ? (atual - 1 + abasDisponiveis.length) % abasDisponiveis.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? ultimo
              : null;
    if (proximo === null) return;
    e.preventDefault();
    const aba = abasDisponiveis[proximo];
    setPerfil(aba);
    document.getElementById(`calc-tab-${aba}`)?.focus();
  };

  return (
    <section className="mt-8 max-w-[640px]">
      {produtoRecalcular && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-[var(--secondary-light)] px-4 py-3 text-[13px] text-[var(--secondary-text)]">
          <span>
            Recalculando preço de <b>{produtoRecalcular.nome}</b>.
          </span>
          <button
            type="button"
            onClick={onCancelarRecalculo}
            className="inline-flex min-h-11 shrink-0 items-center font-medium underline hover:opacity-80"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Seletor de perfil. Padrão ARIA de abas (ONE-68): só a aba ativa entra no
          Tab, as setas trocam de aba, e o link travado do Encomenda fica fora do
          tablist (link não é aba). */}
      <div className="flex flex-wrap gap-2">
        <div
          role="tablist"
          aria-label="Perfil da calculadora"
          className="flex flex-wrap gap-2"
          onKeyDown={aoTeclarNasAbas}
        >
          {(
            [
              { id: "produto", label: "Produto (físico/digital)" },
              { id: "servico", label: "Serviço (por hora)" },
            ] as { id: PerfilCalc; label: string }[]
          ).map((p) => {
            const ativo = perfil === p.id;
            return (
              <button
                key={p.id}
                type="button"
                id={`calc-tab-${p.id}`}
                role="tab"
                aria-selected={ativo}
                tabIndex={ativo ? 0 : -1}
                aria-controls={`calc-painel-${p.id}`}
                onClick={() => setPerfil(p.id)}
                className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-[13px] ${
                  ativo
                    ? "border border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                    : "border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--secondary)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {ehProjete ? (
            <button
              type="button"
              id="calc-tab-encomenda"
              role="tab"
              aria-selected={perfil === "encomenda"}
              tabIndex={perfil === "encomenda" ? 0 : -1}
              aria-controls="calc-painel-encomenda"
              onClick={() => setPerfil("encomenda")}
              className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-[13px] ${
                perfil === "encomenda"
                  ? "border border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                  : "border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--secondary)]"
              }`}
            >
              Encomenda (sob medida)
            </button>
          ) : null}
        </div>
        {!ehProjete && (
          <Link
            to="/upgrade"
            search={{ rota: "/calculadora", tier: "projete" }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] px-4 py-2 text-[13px] text-[var(--muted)] no-underline hover:border-[var(--secondary)]"
          >
            <Lock size={13} aria-hidden="true" />
            Encomenda (sob medida)
          </Link>
        )}
      </div>

      {/* Campos */}
      {perfil === "produto" ? (
        <div id="calc-painel-produto" role="tabpanel" aria-labelledby="calc-tab-produto">
          <GrupoCalc titulo="Custos diretos (por unidade)">
            <BlocoInsumos
              label="Matéria-prima / insumos (R$)"
              total={materiaPrima}
              onTotal={setMateriaPrima}
              detalhado={mpDetalhada}
              onDetalhado={setMpDetalhada}
              itens={itensMp}
              onItens={setItensMp}
              exemploNome="Ex: Papel pólen"
              exemploUnidade="folhas"
              rotuloAdicionar="Adicionar material"
            />
            <BlocoInsumos
              label="Embalagem (R$)"
              total={embalagem}
              onTotal={setEmbalagem}
              detalhado={embDetalhada}
              onDetalhado={setEmbDetalhada}
              itens={itensEmb}
              onItens={setItensEmb}
              exemploNome="Ex: Caixinha kraft"
              exemploUnidade="caixas"
              rotuloAdicionar="Adicionar item de embalagem"
            />
            <BlocoMaoDeObra
              total={maoObra}
              onTotal={setMaoObra}
              detalhado={maoObraDetalhada}
              onDetalhado={setMaoObraDetalhada}
              minutos={minutosPorPeca}
              onMinutos={setMinutosPorPeca}
              valorHora={valorHora}
              campoValorHora={campoValorHora("produto")}
            />
            <CampoNum
              label="Outros custos diretos (R$)"
              value={outrosDiretos}
              onChange={setOutrosDiretos}
            />
          </GrupoCalc>
          <GrupoCalc titulo="Custos fixos e salário (rateio do mês)">
            <div className="sm:col-span-2">
              <BlocoCustosFixos
                total={despesasFixas}
                onTotal={setDespesasFixas}
                detalhado={fixosDetalhado}
                onDetalhado={setFixosDetalhado}
                detalhe={fixosDetalhe}
                onDetalhe={setFixosDetalhe}
                doFinanceiro={fixosDoFinanceiro}
              />
            </div>
            <CampoNum
              label="Pró-labore (seu salário) (R$)"
              dica="Quanto quer tirar pra você por mês. Se a sua hora já entra na mão de obra de cada peça, deixe em branco pra não cobrar duas vezes."
              value={proLabore}
              onChange={setProLabore}
            />
            <CampoNum
              label="Quantas vende por mês"
              dica="Os custos fixos e o salário se dividem por esse número."
              value={qtd}
              onChange={setQtd}
            />
          </GrupoCalc>
          <GrupoCalc titulo="Sobre o preço de venda (%)">
            <CampoNum
              label="Taxa de maquininha / marketplace (%)"
              value={taxaVenda}
              onChange={setTaxaVenda}
            />
            <CampoNum label="Impostos sobre a venda (%)" value={impostos} onChange={setImpostos} />
            <CampoNum label="Quanto quer que sobre (%)" value={margem} onChange={setMargem} />
          </GrupoCalc>
        </div>
      ) : perfil === "servico" ? (
        <div id="calc-painel-servico" role="tabpanel" aria-labelledby="calc-tab-servico">
          <GrupoCalc titulo="Seu trabalho">
            {campoValorHora(
              "servico",
              "O que quer ganhar por hora. Os custos fixos entram mais abaixo.",
            )}
            <CampoNum label="Horas estimadas no serviço" value={horas} onChange={setHoras} />
          </GrupoCalc>
          <GrupoCalc titulo="Custos do projeto">
            <CampoNum label="Materiais / insumos (R$)" value={materiais} onChange={setMateriais} />
            <CampoNum label="Deslocamento (R$)" value={deslocamento} onChange={setDeslocamento} />
            <CampoNum
              label="Ferramentas / software (R$)"
              dica="Só o que é deste serviço. Assinatura mensal entra nos custos fixos."
              value={ferramentas}
              onChange={setFerramentas}
            />
            <CampoNum label="Outros (R$)" value={outrosServico} onChange={setOutrosServico} />
          </GrupoCalc>
          <GrupoCalc titulo="Custos fixos (rateio do mês)">
            <div className="sm:col-span-2">
              <BlocoCustosFixos
                total={despesasFixas}
                onTotal={setDespesasFixas}
                detalhado={fixosDetalhado}
                onDetalhado={setFixosDetalhado}
                detalhe={fixosDetalhe}
                onDetalhe={setFixosDetalhe}
                doFinanceiro={fixosDoFinanceiro}
              />
            </div>
            <CampoNum
              label="Quantos serviços faz por mês"
              dica="Os custos fixos se dividem por esse número."
              value={qtdServicos}
              onChange={setQtdServicos}
            />
            <p className="self-center text-[12.5px] text-[var(--muted)]">
              O seu salário já entra pelo valor da hora, por isso o pró-labore não aparece aqui.
            </p>
          </GrupoCalc>
          <GrupoCalc titulo="Sobre o preço (%)">
            <CampoNum label="Taxa / comissão (%)" value={taxaVendaS} onChange={setTaxaVendaS} />
            <CampoNum
              label="Impostos sobre a venda (%)"
              value={impostosS}
              onChange={setImpostosS}
            />
            <CampoNum label="Quanto quer que sobre (%)" value={margemSeg} onChange={setMargemSeg} />
          </GrupoCalc>
        </div>
      ) : (
        <div id="calc-painel-encomenda" role="tabpanel" aria-labelledby="calc-tab-encomenda">
          {encomendaVazia && (
            <p className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white px-5 py-8 text-center text-[13px] leading-relaxed text-[var(--muted)]">
              Monte a encomenda: adicione os materiais, as horas de trabalho e os custos extras. O
              preço aparece embaixo.
            </p>
          )}

          <div className="mt-6">
            <p className="text-[10px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Materiais
            </p>
            <div className="mt-3 space-y-2">
              {itensMaterial.map((item) => (
                <LinhaMaterial
                  key={item.id}
                  item={item}
                  onChange={(novo) =>
                    setItensMaterial((lista) => lista.map((i) => (i.id === item.id ? novo : i)))
                  }
                  onRemover={() =>
                    setItensMaterial((lista) => lista.filter((i) => i.id !== item.id))
                  }
                  onDuplicar={() =>
                    setItensMaterial((lista) => {
                      const i = lista.findIndex((x) => x.id === item.id);
                      const copia = { ...item, id: novoId() };
                      return [...lista.slice(0, i + 1), copia, ...lista.slice(i + 1)];
                    })
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setItensMaterial((lista) => [
                  ...lista,
                  { id: novoId(), nome: "", quantidade: "1", custoUnitario: "" },
                ])
              }
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              <Plus size={14} aria-hidden="true" />
              Adicionar material
            </button>
          </div>

          <GrupoCalc titulo="Seu trabalho">
            {/* <div> + <label htmlFor>, não <label> envolvendo o botão "usar como
                padrão": o texto dele entrava no nome acessível do campo. */}
            {campoValorHora("encomenda")}
            <CampoNum label="Horas estimadas" value={horas} onChange={setHoras} />
          </GrupoCalc>
          {encomendaSemValorHora && (
            <p className="mt-2 text-[13px] text-[var(--danger)]">
              Defina quanto vale a sua hora pra entrar na conta.{" "}
              <button
                type="button"
                onClick={() => valorHoraFocusRef.current?.focus()}
                className="inline-flex min-h-11 items-center font-medium underline"
              >
                Definir valor por hora
              </button>
            </p>
          )}

          <div className="mt-6">
            <p className="text-[10px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Custos extras
            </p>
            <div className="mt-3 space-y-2">
              {itensExtras.map((item) => (
                <LinhaExtra
                  key={item.id}
                  item={item}
                  onChange={(novo) =>
                    setItensExtras((lista) => lista.map((i) => (i.id === item.id ? novo : i)))
                  }
                  onRemover={() => setItensExtras((lista) => lista.filter((i) => i.id !== item.id))}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setItensExtras((lista) => [...lista, { id: novoId(), descricao: "", valor: "" }])
              }
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              <Plus size={14} aria-hidden="true" />
              Adicionar custo extra
            </button>
          </div>

          <GrupoCalc titulo="Sobre o preço (%)">
            <CampoNum label="Taxa / comissão (%)" value={taxaVendaE} onChange={setTaxaVendaE} />
            <CampoNum
              label="Impostos sobre a venda (%)"
              value={impostosE}
              onChange={setImpostosE}
            />
            <CampoNum
              label="Quanto quer que sobre (%)"
              value={quantoSobraPct}
              onChange={setQuantoSobraPct}
            />
          </GrupoCalc>
        </div>
      )}

      {/* Resultado — na Encomenda, só aparece com algo lançado (estado "vazio" não calcula) */}
      {!encomendaVazia && (
        <>
          <div className="mt-8 rounded-xl bg-[var(--secondary-light)] p-5">
            <p className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--secondary-text)]">
              Preço sugerido
            </p>
            <p className="font-cabinet mt-1 text-[var(--ink)] text-[clamp(28px,5vw,40px)] leading-none">
              {calc.invalido ? "R$ --" : fmt(round2(calc.precoSugerido))}
            </p>
            {calc.invalido && (
              <p className="mt-2 text-[13px] text-[var(--danger)]">
                As porcentagens (taxas + impostos + lucro) somam 100% ou mais. Reduza alguma pra
                calcular o preço.
              </p>
            )}
            {encomendaAbaixoDoPiso && (
              <p className="mt-2 text-[13px] text-[var(--danger)]">
                Esse preço não cobre os custos. O mínimo pra não ter prejuízo é{" "}
                {fmt(round2(encomendaCalc.piso))}.
              </p>
            )}
            {abaixoDoPisoProdutoServico && (
              <p className="mt-2 text-[13px] text-[var(--danger)]">
                Esse preço não cobre os custos. O mínimo pra não ter prejuízo é{" "}
                {fmt(round2(pisoAtual))}.
              </p>
            )}
            <div className="mt-4 space-y-1.5 text-[13px] text-[var(--ink-soft)]">
              {perfil === "produto" ? (
                <>
                  <LinhaCalc
                    label="Custo por unidade"
                    valor={fmt(round2(produtoCalc.custoUnitario))}
                  />
                  <p className="text-[12px] text-[var(--ink-soft)]">
                    diretos {fmt(round2(produtoCalc.custoDireto))} + rateio dos fixos{" "}
                    {fmt(round2(produtoCalc.rateioFixos))}
                    {produtoCalc.rateioSalario > 0 &&
                      ` + salário ${fmt(round2(produtoCalc.rateioSalario))}`}
                  </p>
                  <LinhaCalc
                    label="Preço mínimo (sem lucro)"
                    valor={fmt(round2(produtoCalc.precoMinimo))}
                  />
                </>
              ) : perfil === "servico" ? (
                <>
                  <LinhaCalc label="Custo total" valor={fmt(round2(servicoCalc.custoTotal))} />
                  <p className="text-[12px] text-[var(--muted)]">
                    mão de obra {fmt(round2(servicoCalc.maoDeObra))} + custos do projeto{" "}
                    {fmt(round2(servicoCalc.custosProjeto))}
                    {servicoCalc.rateioFixos > 0 &&
                      ` + rateio dos fixos ${fmt(round2(servicoCalc.rateioFixos))}`}
                  </p>
                </>
              ) : (
                <>
                  <LinhaCalc label="Custo total" valor={fmt(round2(encomendaCalc.custoTotal))} />
                  <p className="text-[12px] text-[var(--muted)]">
                    material {fmt(round2(encomendaCalc.custoMaterial))} + trabalho{" "}
                    {fmt(round2(encomendaCalc.custoTrabalho))} + extras{" "}
                    {fmt(round2(encomendaCalc.custoExtras))}
                  </p>
                  <LinhaCalc label="Piso (sem prejuízo)" valor={fmt(round2(encomendaCalc.piso))} />
                </>
              )}
              {/* Com 100% ou mais o preço cai pro custo (calcularPrecoSugerido) e
                  taxa e lucro saíam calculados sobre esse preço de mentira. */}
              <LinhaCalc
                label="Taxas e impostos"
                valor={calc.invalido ? "R$ --" : fmt(round2(calc.taxasReais))}
              />
              <LinhaCalc
                label="Seu lucro"
                valor={calc.invalido ? "R$ --" : fmt(round2(calc.lucroReais))}
              />
            </div>
            {vendasParaMetaBoa !== null && (
              <p className="mt-4 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--ink-soft)]">
                Pra entrar a Meta do mês ({fmt(metaBoa!)}) só com esse produto: {vendasParaMetaBoa}{" "}
                {vendasParaMetaBoa === 1 ? "venda" : "vendas"} de {fmt(precoParaMeta)}.
              </p>
            )}
          </div>

          {/* Simulador de desconto */}
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-5">
            <CampoNum
              label="Simular com desconto de X% (opcional)"
              value={desconto}
              onChange={setDesconto}
            />
            {simulacaoDesconto && !calc.invalido && (
              <p
                className={`mt-3 text-[13px] ${
                  simulacaoDesconto.prejuizo ? "text-[var(--danger)]" : "text-[var(--ink-soft)]"
                }`}
              >
                Com {descontoPct}% de desconto, o preço cai pra{" "}
                {fmt(round2(simulacaoDesconto.precoComDesconto))} e sobram{" "}
                {fmt(round2(simulacaoDesconto.lucroComDesconto))}.
                {simulacaoDesconto.prejuizo && " Esse desconto dá prejuízo."}
              </p>
            )}
          </div>

          {erro && (
            <p role="alert" className="mt-4 text-[13px] text-[var(--danger)]">
              {erro}
            </p>
          )}

          {/* Salvar */}
          {calc.invalido && (
            <p id="calc-salvar-motivo" className="mt-4 text-[13px] text-[var(--muted)]">
              Pra salvar, as porcentagens precisam somar menos de 100%.
            </p>
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || precoNaoSalvavel || (salvarBloqueado && !produtoRecalcular)}
            aria-describedby={calc.invalido ? "calc-salvar-motivo" : undefined}
            className={`${BTN_ACAO} mt-4`}
          >
            {salvando
              ? "Salvando..."
              : produtoRecalcular
                ? "Salvar novo preço"
                : "Salvar como produto"}
          </button>
        </>
      )}

      <p className="mt-4 text-[13px] text-[var(--muted)]">
        Esses são valores de referência. Considere também o mercado e o posicionamento da sua marca.
      </p>
    </section>
  );
}

function CampoNum({
  label,
  value,
  onChange,
  dica,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dica?: string;
  error?: string;
}) {
  return (
    <Campo label={label} hint={dica} error={error}>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
        placeholder="0"
      />
    </Campo>
  );
}

function GrupoCalc({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="text-[10px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
        {titulo}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function LinhaCalc({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-[var(--ink)]">{valor}</span>
    </p>
  );
}

/* ============== Modo Encomenda: linha de material/extra ============== */
function LinhaMaterial({
  item,
  onChange,
  onRemover,
  onDuplicar,
}: {
  item: ItemMaterial;
  onChange: (novo: ItemMaterial) => void;
  onRemover: () => void;
  onDuplicar: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_90px_120px_auto]">
        <input
          value={item.nome}
          onChange={(e) => onChange({ ...item, nome: e.target.value })}
          aria-label="Nome do material"
          placeholder="Ex: Farinha"
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
        />
        <CampoNum
          label="Quantidade"
          value={item.quantidade}
          onChange={(v) => onChange({ ...item, quantidade: v })}
          error={numInvalido(item.quantidade) ? "Coloque um número." : undefined}
        />
        <CampoNum
          label="Custo unitário (R$)"
          value={item.custoUnitario}
          onChange={(v) => onChange({ ...item, custoUnitario: v })}
          error={numInvalido(item.custoUnitario) ? "Coloque um número." : undefined}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicar}
            aria-label="Duplicar material"
            title="Duplicar"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
          >
            <Copy size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRemover}
            aria-label="Remover material"
            title="Remover"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LinhaExtra({
  item,
  onChange,
  onRemover,
}: {
  item: ItemExtra;
  onChange: (novo: ItemExtra) => void;
  onRemover: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_120px_auto]">
        <input
          value={item.descricao}
          onChange={(e) => onChange({ ...item, descricao: e.target.value })}
          aria-label="Descrição do custo extra"
          placeholder="Ex: Embalagem especial"
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
        />
        <CampoNum
          label="Valor (R$)"
          value={item.valor}
          onChange={(v) => onChange({ ...item, valor: v })}
          error={numInvalido(item.valor) ? "Coloque um número." : undefined}
        />
        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover custo extra"
          title="Remover"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
