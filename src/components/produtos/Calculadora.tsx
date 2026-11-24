import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { hojeISO } from "@/lib/data.functions";
import { Link } from "@tanstack/react-router";
import { Lock, Copy, Plus, Trash2, Check } from "lucide-react";
import { EtiquetaPlano } from "@/components/landing/BlocosLanding";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { toastErro } from "@/lib/toast";
import { useGuardarPrimeiroPreco, type EstadoPrimeiroPreco } from "@/hooks/useGuardarPrimeiroPreco";
import {
  NOME_PRODUTO_MAX,
  deveGuardarSozinho,
  nomeProvisorio,
  resultadoProntoPraGuardar,
} from "@/lib/primeiroPreco";
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
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { tierDosNumeros, tiersPagos } from "@/lib/planos";
import {
  fmt,
  normalizarDigitado,
  num,
  numeroParaCampo,
  numInvalido,
  numPos,
  virgulaNoTexto,
  type Prefill,
  type Produto,
} from "./tipos";
import { LucroPorCanal } from "./LucroPorCanal";
import { CANAIS_ACRESCIMO, precoNoCanal, rateioDaMarca, type CustosMarca } from "@/lib/custosMarca";

type PerfilCalc = "produto" | "servico" | "encomenda";

// Dicas dos campos de % (revisão de 24/11/2026). O lucro é "por dentro": quem
// pensava em % sobre o custo digitava 100 pra dobrar e via "R$ --".
const DICA_TAXA =
  "A parte que a maquininha ou o marketplace fica de cada venda. Taxa fixa por venda, como a da Shopee, entra na comparação por canal, abaixo do preço.";
const DICA_IMPOSTO =
  "No MEI, deixe 0: o DAS é um valor fixo e entra nos custos fixos. No Simples, a alíquota da faixa da marca.";
const DICA_LUCRO =
  "Parte do preço final que fica de lucro, não porcentagem sobre o custo. Com 20%, de cada R$ 100 vendidos, R$ 20 ficam pra marca.";

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

// Campos de número das linhas salvas (insumos, materiais, extras): aparecem
// com vírgula, como os outros (ONE-257). Nome e unidade ficam como estão.
const CAMPOS_NUMERO_ITEM = ["pago", "rende", "uso", "quantidade", "custoUnitario", "valor"];

function parseItens<T>(json: string): T[] {
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.map((item) => {
      if (!item || typeof item !== "object") return item;
      const copia: Record<string, unknown> = { ...item };
      for (const k of CAMPOS_NUMERO_ITEM) {
        if (typeof copia[k] === "string") copia[k] = virgulaNoTexto(copia[k] as string);
      }
      return copia;
    }) as T[];
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
  reservaEquipamentos = 0,
  perfilInicial,
  temPreco = true,
  onPrimeiroPrecoGuardado,
  onCompletarCadastro,
  noCadastro,
  custosIniciais,
}: {
  /**
   * Calculadora aberta dentro do cadastro de produto (ONE-254, 24/11/2026). Sem
   * nome próprio, sem guardar no catálogo e sem salvamento automático: o botão
   * vira "Usar esse preço" e devolve preço, custo e a composição pro cadastro,
   * que só grava no "Salvar produto".
   */
  noCadastro?: {
    /** Composição salva no produto (edição) ou a que ela já usou nesta tela. */
    breakdownInicial: CalculadoraBreakdown | null;
    /**
     * A conta segue o Tipo do cadastro, sem abas (ONE-258): Serviço → serviço,
     * Encomenda (sob medida) → encomenda, o resto → produto.
     */
    perfil: PerfilCalc;
    /**
     * Custos da marca do Financeiro (ONE-258): custos fixos, pró-labore, peças
     * por mês, imposto e taxa de recebimento saem da tela e vêm daqui.
     */
    custosMarca: CustosMarca & { cadastrado: boolean };
    onUsar: (r: {
      precoVenda: number;
      precoCusto: number | null;
      breakdown: CalculadoraBreakdown;
    }) => void;
  };
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
  /** Reserva do mês da aba Equipamentos (0 = sem equipamento ou sem leitura). */
  reservaEquipamentos?: number;
  /**
   * Aba de abertura pedida pela URL (?tipo=, vindo dos "Primeiros passos" do
   * Painel). O produto recalculado tem prioridade: a aba dele é a do breakdown.
   */
  perfilInicial?: "produto" | "servico";
  /**
   * A conta já tem preço calculado (produto com breakdown). Sem preço, o
   * primeiro resultado é guardado sozinho (GRW-90). Padrão true: quem não
   * passa a leitura fica com o botão de sempre.
   */
  temPreco?: boolean;
  /** O primeiro preço foi guardado ou teve o nome trocado: hora de reler o catálogo. */
  onPrimeiroPrecoGuardado?: () => void;
  /** "Completar o cadastro" do primeiro preço guardado: abre o modal do catálogo. */
  onCompletarCadastro?: (produtoId: string) => void;
  /**
   * Calculadora avulsa: custos da marca do Financeiro (ONE-258) que já vêm
   * preenchidos numa conta nova. Dá pra mexer pra simular; nada volta pro Financeiro.
   */
  custosIniciais?: CustosMarca | null;
}) {
  const bk = produtoRecalcular?.calculadora_breakdown ?? noCadastro?.breakdownInicial ?? null;
  // Valor salvo com ponto ("74.38") aparece com vírgula (ONE-257).
  const v = (campo: string) => virgulaNoTexto(bk?.valores?.[campo] ?? "");

  const [perfilEstado, setPerfil] = useState<PerfilCalc>(
    bk?.perfil ??
      (produtoRecalcular
        ? produtoRecalcular.tipo === "servico"
          ? "servico"
          : "produto"
        : (perfilInicial ?? "produto")),
  );
  // No cadastro a conta segue o Tipo do produto, sem abas (ONE-258).
  const perfil: PerfilCalc = noCadastro?.perfil ?? perfilEstado;
  // No cadastro, os custos da marca vêm do Financeiro e os campos deles saem
  // da tela. Os estados abaixo continuam valendo pra Calculadora avulsa; aqui
  // eles são trocados pelos números do Financeiro, com o mesmo nome, pra a
  // conta e a composição salva (lida pela Projeção) não mudarem de forma.
  const marca = noCadastro?.custosMarca ?? null;
  const textoMarca = (n: number) => (n > 0 ? numeroParaCampo(n) : "");
  const pecasDaMarca = marca?.pecasMes ? String(marca.pecasMes) : "";
  // "Usar esse preço" acabou de preencher o cadastro: o aviso some quando a
  // conta muda de novo.
  const [usadoNoCadastro, setUsadoNoCadastro] = useState(false);

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
  const [qtdEstado, setQtd] = useState(() => v("qtd"));
  const [proLaboreEstado, setProLabore] = useState(() => v("proLabore"));
  const [taxaVendaEstado, setTaxaVenda] = useState(() => v("taxaVenda"));
  const [impostosEstado, setImpostos] = useState(() => v("impostos"));
  const qtd = marca ? pecasDaMarca : qtdEstado;
  const proLabore = marca ? textoMarca(marca.proLabore) : proLaboreEstado;
  const taxaVenda = marca ? textoMarca(marca.taxaRecebimentoPct) : taxaVendaEstado;
  const impostos = marca ? textoMarca(marca.impostoPct) : impostosEstado;
  const [margem, setMargem] = useState(() => v("margem"));

  // ── Perfil Serviço ──
  const [valorHora, setValorHora] = useState(() => v("valorHora"));
  const [horas, setHoras] = useState(() => v("horas"));
  const [materiais, setMateriais] = useState(() => v("materiais"));
  const [deslocamento, setDeslocamento] = useState(() => v("deslocamento"));
  const [ferramentas, setFerramentas] = useState(() => v("ferramentas"));
  const [outrosServico, setOutrosServico] = useState(() => v("outrosServico"));
  const [taxaVendaSEstado, setTaxaVendaS] = useState(() => v("taxaVendaS"));
  const [impostosSEstado, setImpostosS] = useState(() => v("impostosS"));
  const taxaVendaS = marca ? textoMarca(marca.taxaRecebimentoPct) : taxaVendaSEstado;
  const impostosS = marca ? textoMarca(marca.impostoPct) : impostosSEstado;
  const [margemSeg, setMargemSeg] = useState(() => v("margemSeg"));
  const [qtdServicosEstado, setQtdServicos] = useState(() => v("qtdServicos"));
  const qtdServicos = marca ? pecasDaMarca : qtdServicosEstado;

  // ── Custos fixos do mês (Produto e Serviço) ──
  // Mesmo estado nas duas abas, como o valor-hora: o aluguel é o mesmo,
  // vendendo peça ou serviço. Detalhado, o total é a soma dos itens.
  const [despesasFixasEstado, setDespesasFixas] = useState(() => v("despesasFixas"));
  const [fixosDetalhadoEstado, setFixosDetalhado] = useState(() => v("fixosDetalhado") === "1");
  const despesasFixas = marca ? textoMarca(marca.fixosMes) : despesasFixasEstado;
  const fixosDetalhado = marca ? false : fixosDetalhadoEstado;
  const [fixosDetalhe, setFixosDetalhe] = useState<DetalheFixos>(() =>
    Object.fromEntries(
      ITENS_CUSTO_FIXO.map((i) => [i.chave, v(PREFIXO_FIXO + i.chave)]).filter(([, x]) => x),
    ),
  );
  // numPos: custo negativo digitado não baixa a conta (o campo fica marcado
  // em vermelho e o preço não é guardado até corrigir).
  const fixosMes = fixosDetalhado ? somarCustosFixos(fixosDetalhe) : numPos(despesasFixas);
  const materiaPrimaVal = mpDetalhada ? totalDosInsumos(itensMp) : numPos(materiaPrima);
  const embalagemVal = embDetalhada ? totalDosInsumos(itensEmb) : numPos(embalagem);
  const maoObraVal = maoObraDetalhada
    ? maoDeObraPorPeca(numPos(minutosPorPeca), numPos(valorHora))
    : numPos(maoObra);

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
  const [taxaVendaEEstado, setTaxaVendaE] = useState(() => v("taxaVendaE"));
  const [impostosEEstado, setImpostosE] = useState(() => v("impostosE"));
  const taxaVendaE = marca ? textoMarca(marca.taxaRecebimentoPct) : taxaVendaEEstado;
  const impostosE = marca ? textoMarca(marca.impostoPct) : impostosEEstado;
  const [quantoSobraPct, setQuantoSobraPct] = useState(() => v("quantoSobraPct"));
  // Desde 24/11/2026 a Encomenda também rateia os custos fixos (antes o
  // aluguel ficava de fora e a mesma peça saía mais barata aqui que no Produto).
  const [qtdEncomendasEstado, setQtdEncomendas] = useState(() => v("qtdEncomendas"));
  const qtdEncomendas = marca ? pecasDaMarca : qtdEncomendasEstado;
  const [valorHoraSalvo, setValorHoraSalvo] = useState(false);
  const [salvandoValorHora, setSalvandoValorHora] = useState(false);
  const valorHoraFocusRef = useRef<HTMLInputElement>(null);

  // Preenche o valor-hora com o padrão salvo assim que ele carrega, só se o
  // campo ainda estiver vazio (nunca sobrescreve o que veio do breakdown ou
  // o que ela já digitou nesta sessão).
  useEffect(() => {
    if (valorHoraPadrao != null && !valorHora) {
      setValorHora(numeroParaCampo(valorHoraPadrao));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorHoraPadrao]);

  // Calculadora avulsa numa conta nova: os custos da marca do Financeiro
  // (ONE-258) entram nos campos vazios assim que carregam. Conta salva
  // (recálculo) fica com os números dela.
  useEffect(() => {
    const c = custosIniciais;
    if (!c || bk || noCadastro) return;
    const preencher = (atual: string, set: (s: string) => void, valor: string) => {
      if (!atual && valor) set(valor);
    };
    const t = (n: number) => (n > 0 ? numeroParaCampo(n) : "");
    const pecas = c.pecasMes ? String(c.pecasMes) : "";
    if (!despesasFixasEstado && !fixosDetalhadoEstado) {
      if (Object.keys(c.fixosDetalhe).length > 0) {
        setFixosDetalhe(c.fixosDetalhe as DetalheFixos);
        setFixosDetalhado(true);
      } else preencher(despesasFixasEstado, setDespesasFixas, t(c.fixosMes));
    }
    preencher(proLaboreEstado, setProLabore, t(c.proLabore));
    preencher(qtdEstado, setQtd, pecas);
    preencher(qtdServicosEstado, setQtdServicos, pecas);
    preencher(qtdEncomendasEstado, setQtdEncomendas, pecas);
    preencher(taxaVendaEstado, setTaxaVenda, t(c.taxaRecebimentoPct));
    preencher(taxaVendaSEstado, setTaxaVendaS, t(c.taxaRecebimentoPct));
    preencher(taxaVendaEEstado, setTaxaVendaE, t(c.taxaRecebimentoPct));
    preencher(impostosEstado, setImpostos, t(c.impostoPct));
    preencher(impostosSEstado, setImpostosS, t(c.impostoPct));
    preencher(impostosEEstado, setImpostosE, t(c.impostoPct));
    // Só na chegada dos custos: depois disso, o que ela digita manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custosIniciais]);

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
    const custoDireto = materiaPrimaVal + embalagemVal + maoObraVal + numPos(outrosDiretos);
    const rateioFixos = calcularRateio({ custosFixosMes: fixosMes, qtdMes: numPos(qtd) });
    const rateioSalario = calcularRateio({
      custosFixosMes: 0,
      proLaboreMes: numPos(proLabore),
      qtdMes: numPos(qtd),
    });
    const custoUnitario = custoDireto + rateioFixos + rateioSalario;
    const taxaVendaPct = numPos(taxaVenda);
    const impostosPct = numPos(impostos);
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
    const maoDeObra = numPos(valorHora) * numPos(horas);
    const custosProjeto =
      numPos(materiais) + numPos(deslocamento) + numPos(ferramentas) + numPos(outrosServico);
    const rateioFixos = calcularRateio({
      custosFixosMes: fixosMes,
      qtdMes: numPos(qtdServicos),
    });
    const custoTotal = maoDeObra + custosProjeto + rateioFixos;
    const taxaVendaPct = numPos(taxaVendaS);
    const impostosPct = numPos(impostosS);
    const pctVenda = taxaVendaPct + impostosPct;
    const pctTotal = pctVenda + num(margemSeg);
    const invalido = pctTotal >= 100;
    // O Serviço não mostrava o preço mínimo, que Produto e Encomenda mostram.
    const precoMinimo = calcularPrecoSugerido(custoTotal, pctVenda);
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
      precoMinimo,
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
          quantidade: numPos(it.quantidade),
          custoUnitario: numPos(it.custoUnitario),
        })),
        horas: numPos(horas),
        valorHora: numPos(valorHora),
        itensExtras: itensExtras.map((it) => ({ valor: numPos(it.valor) })),
        custosFixosMes: fixosMes,
        qtdMes: numPos(qtdEncomendas),
        taxaVendaPct: numPos(taxaVendaE),
        impostosPct: numPos(impostosE),
        quantoSobraPct: num(quantoSobraPct),
      }),
    [
      itensMaterial,
      horas,
      valorHora,
      itensExtras,
      fixosMes,
      qtdEncomendas,
      taxaVendaE,
      impostosE,
      quantoSobraPct,
    ],
  );

  // Revisão de 24/11/2026: três motivos pra não mostrar preço nenhum, em vez
  // de mostrar um preço errado. (1) Taxa + imposto + lucro em 100% ou mais.
  // (2) Custo fixo ou salário lançado sem "quantas por mês": dividia por 1 e o
  // aluguel inteiro caía numa peça (e o primeiro preço podia ser guardado
  // assim). (3) Campo com número inválido ou custo negativo.
  const qtdDoPerfil =
    perfil === "produto" ? qtd : perfil === "servico" ? qtdServicos : qtdEncomendas;
  const temRateio = fixosMes > 0 || (perfil === "produto" && numPos(proLabore) > 0);
  const faltaQtd = temRateio && numPos(qtdDoPerfil) <= 0;
  const camposDoPerfil: string[] =
    perfil === "produto"
      ? [
          ...(mpDetalhada ? itensMp.flatMap((i) => [i.pago, i.rende, i.uso]) : [materiaPrima]),
          ...(embDetalhada ? itensEmb.flatMap((i) => [i.pago, i.rende, i.uso]) : [embalagem]),
          ...(maoObraDetalhada ? [minutosPorPeca, valorHora] : [maoObra]),
          outrosDiretos,
          proLabore,
          qtd,
          taxaVenda,
          impostos,
        ]
      : perfil === "servico"
        ? [
            valorHora,
            horas,
            materiais,
            deslocamento,
            ferramentas,
            outrosServico,
            qtdServicos,
            taxaVendaS,
            impostosS,
          ]
        : [
            ...itensMaterial.flatMap((i) => [i.quantidade, i.custoUnitario]),
            ...itensExtras.map((i) => i.valor),
            valorHora,
            horas,
            qtdEncomendas,
            taxaVendaE,
            impostosE,
          ];
  const fixosDigitados = fixosDetalhado ? Object.values(fixosDetalhe) : [despesasFixas];
  const lucroDigitado =
    perfil === "produto" ? margem : perfil === "servico" ? margemSeg : quantoSobraPct;
  const temCampoInvalido =
    [...camposDoPerfil, ...fixosDigitados].some((s) => numInvalido(s ?? "")) ||
    numInvalido(lucroDigitado, true);

  const calcBase =
    perfil === "produto" ? produtoCalc : perfil === "servico" ? servicoCalc : encomendaCalc;
  const pctSomado =
    perfil === "produto"
      ? numPos(taxaVenda) + numPos(impostos) + num(margem)
      : perfil === "servico"
        ? numPos(taxaVendaS) + numPos(impostosS) + num(margemSeg)
        : numPos(taxaVendaE) + numPos(impostosE) + num(quantoSobraPct);
  const fmtPct = (p: number) => `${Math.round(p * 100) / 100}`.replace(".", ",");
  const motivoSemPreco: string | null = temCampoInvalido
    ? "Tem campo com número que a conta não entende. Corrija o que está marcado em vermelho."
    : faltaQtd && marca
      ? "Faltam as peças vendidas por mês em Financeiro, na aba Custos da marca. Sem esse número, o custo fixo inteiro cairia numa peça só."
      : faltaQtd
        ? perfil === "produto"
          ? 'Falta "Quantas peças a marca vende por mês". Sem esse número, o custo fixo e o salário inteiros cairiam numa peça só.'
          : perfil === "servico"
            ? 'Falta "Quantos serviços a marca faz por mês". Sem esse número, o custo fixo inteiro cairia num serviço só.'
            : 'Falta "Quantas encomendas a marca faz por mês". Sem esse número, o custo fixo inteiro cairia numa encomenda só.'
        : calcBase.invalido
          ? `Taxa, imposto e lucro somam ${fmtPct(pctSomado)}%. Aqui o lucro é uma parte do preço final, não do custo, então a soma precisa ficar abaixo de 100%. Baixe alguma delas.`
          : null;
  // `calc.invalido` passa a valer pros três motivos: todo lugar que escondia o
  // preço com as porcentagens em 100% esconde também nos outros dois.
  const calc = { ...calcBase, invalido: motivoSemPreco !== null };
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
    !calc.invalido && lucroPorVenda > 0 && metaBoa
      ? vendasParaFaturar(metaBoa, precoParaMeta)
      : null;
  const taxaVendaPctAtual =
    perfil === "produto"
      ? numPos(taxaVenda)
      : perfil === "servico"
        ? numPos(taxaVendaS)
        : numPos(taxaVendaE);
  const impostosPctAtual =
    perfil === "produto"
      ? numPos(impostos)
      : perfil === "servico"
        ? numPos(impostosS)
        : numPos(impostosE);
  // Custo com rateio dividido por 1 (falta a quantidade) ou campo inválido:
  // o custo também sai da tela, não só o preço.
  const escondeCusto = faltaQtd || temCampoInvalido;

  // Estados específicos do modo Encomenda (PRD): vazio, parcial (sem
  // valor-hora com horas lançadas) e erro de negócio (preço abaixo do piso).
  const encomendaVazia =
    perfil === "encomenda" &&
    itensMaterial.length === 0 &&
    itensExtras.length === 0 &&
    num(horas) <= 0;
  const encomendaSemValorHora = perfil === "encomenda" && num(horas) > 0 && num(valorHora) <= 0;
  const encomendaAbaixoDoPiso =
    perfil === "encomenda" && !encomendaVazia && !calc.invalido && num(quantoSobraPct) < 0;

  // Preço abaixo do piso nos perfis Produto e Serviço (sobra pedida negativa):
  // a Encomenda já avisava, os outros dois mostravam "Seu lucro" negativo calado.
  const abaixoDoPisoProdutoServico =
    perfil !== "encomenda" && !calc.invalido && round2(calc.lucroReais) < 0;
  const pisoAtual = calcularPrecoSugerido(custoBase, taxaVendaPctAtual + impostosPctAtual);

  // Salvar com as porcentagens em 100% ou mais gravava o próprio custo como
  // preço de venda (calcularPrecoSugerido cai pro custo nesse caso). Preço
  // zerado também não vira produto nem substitui o preço de um existente.
  const precoNaoSalvavel = calc.invalido || round2(calc.precoSugerido) <= 0;

  // A conta mudou depois do "Usar esse preço": o aviso de "preenchido" sai.
  const precoDaConta = round2(calc.precoSugerido);
  useEffect(() => {
    setUsadoNoCadastro(false);
  }, [precoDaConta, custoBase, perfil]);

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
          ...fixosParaBreakdown(),
          qtdEncomendas,
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
        // O "Qual produto?" do topo já preenche o nome no cadastro (01/11/2026).
        nome: primeiroPreco.nome.trim().slice(0, NOME_PRODUTO_MAX).trim(),
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

  // ── Primeiro preço guardado sozinho (GRW-90) ──
  // "Visto" = o bloco do resultado entrou na tela pelo menos uma vez. Sem isso
  // o primeiro campo preenchido já daria um preço válido e gravaria a conta
  // pela metade. Sem IntersectionObserver (teste, navegador antigo), conta como visto.
  const resultadoRef = useRef<HTMLDivElement>(null);
  const [resultadoVisto, setResultadoVisto] = useState(false);
  const temResultadoNaTela = !encomendaVazia;
  useEffect(() => {
    if (resultadoVisto || !temResultadoNaTela) return;
    const el = resultadoRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setResultadoVisto(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setResultadoVisto(true);
      },
      // 25%: no celular o bloco do resultado pode passar da metade da tela.
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [resultadoVisto, temResultadoNaTela]);

  const resultadoPronto = resultadoProntoPraGuardar({ precoNaoSalvavel, resultadoVisto });

  // Chegou ao preço: uma vez por montagem (mede quantas chegam ao resultado).
  // Encomenda travada (sem Pro) não mostra o preço: não conta como resultado.
  const resultadoRegistradoRef = useRef(false);
  const precoFechadoNoPlano = perfil === "encomenda" && !ehProjete;
  useEffect(() => {
    if (!resultadoPronto || precoFechadoNoPlano || resultadoRegistradoRef.current) return;
    resultadoRegistradoRef.current = true;
    void registrar("feature_completed", {
      feature: "calculadora",
      propriedades: { passo: "resultado", perfil },
    });
  }, [resultadoPronto, precoFechadoNoPlano, perfil]);

  const primeiroPreco = useGuardarPrimeiroPreco({
    userId,
    // No cadastro, quem grava é o "Salvar produto": nada de salvar sozinho.
    ativo:
      !noCadastro && deveGuardarSozinho({ temPreco, recalculando: !!produtoRecalcular, perfil }),
    pronto: !noCadastro && resultadoPronto && perfil !== "encomenda" && !produtoRecalcular,
    valores: {
      perfil,
      precoVenda: round2(calc.precoSugerido),
      precoCusto: round2(custoBase) || null,
      breakdown: buildBreakdown(),
    },
    onCriado: onPrimeiroPrecoGuardado,
  });
  // O bloco automático fica no lugar do botão enquanto a conta está na regra,
  // e continua depois de guardar (a releitura de "tem preço" já vê o produto).
  const modoPrimeiroPreco =
    !noCadastro &&
    perfil !== "encomenda" &&
    !produtoRecalcular &&
    (primeiroPreco.produtoId !== null ||
      deveGuardarSozinho({ temPreco, recalculando: false, perfil }));

  // "Qual produto?" no topo de cada aba (01/11/2026). No teste de 01/11 o
  // primeiro preço foi guardado sozinho como "Primeiro produto" e chegou assim
  // no pedido ("2x Primeiro produto"): o nome só aparecia depois de guardar.
  // Preenchido, o salvamento automático (GRW-90) e o "Guardar esse preço" usam
  // esse nome; vazio, fica o provisório de sempre. Um estado só, o do hook.
  // Recalculando, o produto já tem nome: o campo some.
  const campoNomeProduto = (onde: PerfilCalc) => {
    // No cadastro o nome é o campo "Nome" do próprio cadastro.
    if (produtoRecalcular || noCadastro) return null;
    const rotulo =
      onde === "servico"
        ? "Qual serviço?"
        : onde === "encomenda"
          ? "Qual encomenda?"
          : "Qual produto?";
    const exemplo =
      onde === "servico"
        ? "ex: Sessão de fotos"
        : onde === "encomenda"
          ? "ex: Bolo de aniversário"
          : "ex: Caderno A5";
    return (
      <div className="mt-6">
        <Campo
          id={`calc-nome-${onde}`}
          label={rotulo}
          error={primeiroPreco.erroNome ?? undefined}
          hint={
            primeiroPreco.produtoId
              ? "O nome muda no catálogo quando você sai do campo."
              : undefined
          }
        >
          <input
            value={primeiroPreco.nome}
            onChange={(e) => primeiroPreco.setNome(e.target.value.slice(0, NOME_PRODUTO_MAX))}
            onBlur={() => {
              if (primeiroPreco.produtoId) void primeiroPreco.salvarNome();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && primeiroPreco.produtoId) {
                e.preventDefault();
                void primeiroPreco.salvarNome();
              }
            }}
            maxLength={NOME_PRODUTO_MAX}
            placeholder={exemplo}
            autoComplete="off"
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[16px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--secondary-text)] focus:outline-none sm:text-[14px]"
          />
        </Campo>
      </div>
    );
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
          type="text"
          inputMode="decimal"
          value={valorHora}
          onChange={(e) => setValorHora(normalizarDigitado(e.target.value))}
          disabled={valorHoraPadraoCarregando && !valorHora}
          aria-invalid={numInvalido(valorHora) || undefined}
          aria-describedby={
            [dica ? `${id}-dica` : "", numInvalido(valorHora) ? `${id}-erro` : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none disabled:bg-[var(--surface)]"
          placeholder={valorHoraPadraoCarregando && !valorHora ? "carregando..." : "0"}
        />
        {dica && (
          <p id={`${id}-dica`} className="mt-1.5 text-[12.5px] text-[var(--muted)]">
            {dica}
          </p>
        )}
        {numInvalido(valorHora) && (
          <p id={`${id}-erro`} className="mt-1.5 text-[12.5px] text-[var(--danger)]">
            Coloque um número.
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

  // Desde 20/10/2026 (GRW-66) a aba Encomenda abre em todo plano: no Grátis e no
  // Premium ela calcula o custo, mas o preço sugerido e o lucro ficam fechados
  // atrás do Pro. Antes o clique levava direto pro /upgrade, e 4 das 7 contas do
  // Grátis que viram a tela de preço chegaram por esse cadeado sem ver nada.
  const abasDisponiveis: PerfilCalc[] = ["produto", "servico", "encomenda"];
  const encomendaTravada = perfil === "encomenda" && !ehProjete;
  // Encomenda é do Pro até 30/11/2026 e do Premium depois (virada de preços).
  const tierEncomenda = tierDosNumeros();
  const planoEncomenda = tiersPagos()[tierEncomenda].titulo;
  // No cadastro: o resumo dos custos da marca no lugar dos campos que saíram
  // (ONE-258). "Mudar no Financeiro" abre em outra aba pra não perder o cadastro;
  // na volta, a leitura se refaz sozinha (foco na janela).
  // Acréscimo por marketplace (ONE-259): do cadastro (marca) ou, na avulsa, do Financeiro.
  const acrescimos = (marca ?? custosIniciais)?.acrescimoCanais ?? {};
  const canaisComAcrescimo = CANAIS_ACRESCIMO.map((c) => ({
    chave: c.chave,
    nome: c.nome,
    pct: acrescimos[c.chave] ?? 0,
  })).filter((c) => c.pct > 0);

  const blocoMarca = (onde: PerfilCalc) => {
    if (!marca) return null;
    const comSalario = onde === "produto";
    const rateio = rateioDaMarca(marca, comSalario);
    const pct = (n: number) => `${numeroParaCampo(n).replace(/,00$/, "")}%`;
    return (
      <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4 text-[13px] text-[var(--ink-soft)]">
        <p className="text-[10px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          Custos da marca, do Financeiro
        </p>
        {!marca.cadastrado ? (
          <p className="mt-2">
            Os custos da marca ainda não foram preenchidos. Sem eles, o preço considera só os custos
            da peça, o imposto e a taxa ficam em 0 e o aluguel não entra na conta.
          </p>
        ) : (
          <p className="mt-2">
            {marca.fixosMes > 0 || (comSalario && marca.proLabore > 0)
              ? rateio == null
                ? `${fmt(marca.fixosMes)} de custos fixos${comSalario && marca.proLabore > 0 ? ` e ${fmt(marca.proLabore)} de salário` : ""}, sem as peças vendidas por mês pra dividir.`
                : `${fmt(marca.fixosMes)} de custos fixos${comSalario && marca.proLabore > 0 ? ` e ${fmt(marca.proLabore)} de salário` : ""} divididos por ${marca.pecasMes} ${marca.pecasMes === 1 ? "peça" : "peças"}: ${fmt(Math.round(rateio * 100) / 100)} em cada uma.`
              : "Sem custos fixos cadastrados."}{" "}
            Imposto {pct(marca.impostoPct)} e taxa de recebimento {pct(marca.taxaRecebimentoPct)}.
            {!comSalario && " O salário entra pelo valor da hora."}
          </p>
        )}
        <a
          href="/financeiro#custos-da-marca"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
        >
          {marca.cadastrado ? "Mudar no Financeiro" : "Preencher no Financeiro"}
          <span className="sr-only"> (abre em outra aba)</span>
        </a>
      </div>
    );
  };

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
      {!noCadastro && (
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
            {/* A etiqueta "Pro" avisa antes do clique (14/10/2026). Fora do Pro a
              aba abre mesmo assim: calcula o custo e fecha só o preço. */}
            <button
              type="button"
              id="calc-tab-encomenda"
              role="tab"
              aria-selected={perfil === "encomenda"}
              tabIndex={perfil === "encomenda" ? 0 : -1}
              aria-controls="calc-painel-encomenda"
              onClick={() => {
                setPerfil("encomenda");
                if (!ehProjete) track("encomenda_previa_aberta");
              }}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] ${
                perfil === "encomenda"
                  ? "border border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                  : "border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--secondary)]"
              }`}
            >
              {!ehProjete && <Lock size={13} aria-hidden="true" />}
              Encomenda (sob medida)
              {!ehProjete && (
                <>
                  <span className="sr-only">, preço do plano</span>
                  <EtiquetaPlano nome={planoEncomenda} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Campos */}
      {perfil === "produto" ? (
        <div id="calc-painel-produto" role="tabpanel" aria-labelledby="calc-tab-produto">
          {campoNomeProduto("produto")}
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
          {marca ? (
            blocoMarca("produto")
          ) : (
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
                  reservaEquipamentos={reservaEquipamentos}
                />
              </div>
              <CampoNum
                label="Pró-labore (seu salário) (R$)"
                dica="Quanto quer tirar pra você por mês. Se a sua hora já entra na mão de obra de cada peça, deixe em branco pra não cobrar duas vezes."
                value={proLabore}
                onChange={setProLabore}
              />
              <CampoNum
                label="Quantas peças a marca vende por mês"
                dica="Some todos os produtos, não só este. O custo fixo é da marca inteira e se divide entre todas as peças; contando só este produto, o aluguel todo cai em cima dele."
                value={qtd}
                onChange={setQtd}
              />
            </GrupoCalc>
          )}
          <GrupoCalc titulo={marca ? "Lucro" : "Sobre o preço de venda (%)"}>
            {!marca && (
              <>
                <CampoNum
                  label="Taxa de maquininha / marketplace (%)"
                  dica={DICA_TAXA}
                  value={taxaVenda}
                  onChange={setTaxaVenda}
                />
                <CampoNum
                  label="Impostos sobre a venda (%)"
                  dica={DICA_IMPOSTO}
                  value={impostos}
                  onChange={setImpostos}
                />
              </>
            )}
            <CampoNum
              label="Quanto quer lucrar (%)"
              dica={DICA_LUCRO}
              value={margem}
              onChange={setMargem}
              permiteNegativo
            />
          </GrupoCalc>
        </div>
      ) : perfil === "servico" ? (
        <div id="calc-painel-servico" role="tabpanel" aria-labelledby="calc-tab-servico">
          {campoNomeProduto("servico")}
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
          {marca ? (
            blocoMarca("servico")
          ) : (
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
                  reservaEquipamentos={reservaEquipamentos}
                />
              </div>
              <CampoNum
                label="Quantos serviços a marca faz por mês"
                dica="Some todos os serviços, não só este. O custo fixo é da marca inteira e se divide entre todos os atendimentos; contando só este serviço, o aluguel todo cai em cima dele."
                value={qtdServicos}
                onChange={setQtdServicos}
              />
              <p className="self-center text-[12.5px] text-[var(--muted)]">
                O seu salário já entra pelo valor da hora, por isso o pró-labore não aparece aqui.
              </p>
            </GrupoCalc>
          )}
          <GrupoCalc titulo={marca ? "Lucro" : "Sobre o preço (%)"}>
            {!marca && (
              <>
                <CampoNum
                  label="Taxa / comissão (%)"
                  dica={DICA_TAXA}
                  value={taxaVendaS}
                  onChange={setTaxaVendaS}
                />
                <CampoNum
                  label="Impostos sobre a venda (%)"
                  dica={DICA_IMPOSTO}
                  value={impostosS}
                  onChange={setImpostosS}
                />
              </>
            )}
            <CampoNum
              label="Quanto quer lucrar (%)"
              dica={DICA_LUCRO}
              value={margemSeg}
              onChange={setMargemSeg}
              permiteNegativo
            />
          </GrupoCalc>
        </div>
      ) : (
        <div id="calc-painel-encomenda" role="tabpanel" aria-labelledby="calc-tab-encomenda">
          {!encomendaTravada && campoNomeProduto("encomenda")}
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

          {marca ? (
            blocoMarca("encomenda")
          ) : (
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
                  reservaEquipamentos={reservaEquipamentos}
                />
              </div>
              <CampoNum
                label="Quantas encomendas a marca faz por mês"
                dica="Some todas as encomendas e vendas do mês, não só esta. O custo fixo é da marca inteira e se divide entre todas."
                value={qtdEncomendas}
                onChange={setQtdEncomendas}
              />
              <p className="self-center text-[12.5px] text-[var(--muted)]">
                O seu salário já entra pelo valor da hora, por isso o pró-labore não aparece aqui.
              </p>
            </GrupoCalc>
          )}

          <GrupoCalc titulo={marca ? "Lucro" : "Sobre o preço (%)"}>
            {!marca && (
              <>
                <CampoNum
                  label="Taxa / comissão (%)"
                  dica={DICA_TAXA}
                  value={taxaVendaE}
                  onChange={setTaxaVendaE}
                />
                <CampoNum
                  label="Impostos sobre a venda (%)"
                  dica={DICA_IMPOSTO}
                  value={impostosE}
                  onChange={setImpostosE}
                />
              </>
            )}
            <CampoNum
              label="Quanto quer lucrar (%)"
              dica={DICA_LUCRO}
              value={quantoSobraPct}
              onChange={setQuantoSobraPct}
              permiteNegativo
            />
          </GrupoCalc>
        </div>
      )}

      {/* Resultado — na Encomenda, só aparece com algo lançado (estado "vazio" não calcula) */}
      {!encomendaVazia && (
        <>
          <div ref={resultadoRef} className="mt-8 rounded-xl bg-[var(--secondary-light)] p-5">
            <p className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--secondary-text)]">
              Preço sugerido
            </p>
            <p className="font-cabinet mt-1 text-[var(--ink)] text-[clamp(28px,5vw,40px)] leading-none">
              {/* Travada: o número nem vai pro DOM, senão bastava inspecionar. */}
              {encomendaTravada ? (
                <span
                  aria-label={`Preço fechado, abre no plano ${planoEncomenda}`}
                  className="select-none"
                >
                  R$ ···
                </span>
              ) : calc.invalido ? (
                "R$ --"
              ) : (
                fmt(round2(calc.precoSugerido))
              )}
            </p>
            {encomendaTravada && (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="text-[14px] text-[var(--ink)]">
                  A Pólia One já somou o custo dessa encomenda:{" "}
                  <b>{fmt(round2(encomendaCalc.custoTotal))}</b>. O preço sugerido e quanto a marca
                  lucra nela abrem no {planoEncomenda}.
                </p>
                <Link
                  to="/assinar"
                  search={{ plano: tierEncomenda, rota: "/calculadora" }}
                  onClick={() => track("encomenda_previa_cta")}
                  className={`${BTN_ACAO} mt-3 no-underline`}
                >
                  Quero ver o preço da encomenda
                </Link>
              </div>
            )}
            {motivoSemPreco && (
              <p className="mt-2 text-[13px] text-[var(--danger)]">{motivoSemPreco}</p>
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
                    valor={escondeCusto ? "R$ --" : fmt(round2(produtoCalc.custoUnitario))}
                  />
                  {!escondeCusto && (
                    <p className="text-[12px] text-[var(--ink-soft)]">
                      diretos {fmt(round2(produtoCalc.custoDireto))} + rateio dos fixos{" "}
                      {fmt(round2(produtoCalc.rateioFixos))}
                      {produtoCalc.rateioSalario > 0 &&
                        ` + salário ${fmt(round2(produtoCalc.rateioSalario))}`}
                    </p>
                  )}
                  <LinhaCalc
                    label="Preço mínimo (sem lucro)"
                    valor={escondeCusto ? "R$ --" : fmt(round2(produtoCalc.precoMinimo))}
                  />
                </>
              ) : perfil === "servico" ? (
                <>
                  <LinhaCalc
                    label="Custo total"
                    valor={escondeCusto ? "R$ --" : fmt(round2(servicoCalc.custoTotal))}
                  />
                  {!escondeCusto && (
                    <p className="text-[12px] text-[var(--muted)]">
                      mão de obra {fmt(round2(servicoCalc.maoDeObra))} + custos do projeto{" "}
                      {fmt(round2(servicoCalc.custosProjeto))}
                      {servicoCalc.rateioFixos > 0 &&
                        ` + rateio dos fixos ${fmt(round2(servicoCalc.rateioFixos))}`}
                    </p>
                  )}
                  <LinhaCalc
                    label="Preço mínimo (sem lucro)"
                    valor={escondeCusto ? "R$ --" : fmt(round2(servicoCalc.precoMinimo))}
                  />
                </>
              ) : (
                <>
                  <LinhaCalc
                    label="Custo total"
                    valor={escondeCusto ? "R$ --" : fmt(round2(encomendaCalc.custoTotal))}
                  />
                  {!escondeCusto && (
                    <p className="text-[12px] text-[var(--muted)]">
                      material {fmt(round2(encomendaCalc.custoMaterial))} + trabalho{" "}
                      {fmt(round2(encomendaCalc.custoTrabalho))} + extras{" "}
                      {fmt(round2(encomendaCalc.custoExtras))}
                      {encomendaCalc.rateioFixos > 0 &&
                        ` + rateio dos fixos ${fmt(round2(encomendaCalc.rateioFixos))}`}
                    </p>
                  )}
                  <LinhaCalc
                    label="Piso (sem prejuízo)"
                    valor={escondeCusto ? "R$ --" : fmt(round2(encomendaCalc.piso))}
                  />
                </>
              )}
              {/* Com 100% ou mais o preço cai pro custo (calcularPrecoSugerido) e
                  taxa e lucro saíam calculados sobre esse preço de mentira. */}
              <LinhaCalc
                label="Taxas e impostos"
                valor={
                  encomendaTravada
                    ? "R$ ···"
                    : calc.invalido
                      ? "R$ --"
                      : fmt(round2(calc.taxasReais))
                }
              />
              <LinhaCalc
                label="Seu lucro"
                valor={
                  encomendaTravada
                    ? "R$ ···"
                    : calc.invalido
                      ? "R$ --"
                      : fmt(round2(calc.lucroReais))
                }
              />
            </div>
            {/* Preço por canal (ONE-259): o acréscimo de cada marketplace, cadastrado
                em Marketplaces, em cima do preço da venda direta. */}
            {!encomendaTravada && !calc.invalido && canaisComAcrescimo.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--ink-soft)]">
                <p className="text-[10px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Preço por canal
                </p>
                <LinhaCalc
                  label="Loja da marca e venda direta"
                  valor={fmt(round2(calc.precoSugerido))}
                />
                {canaisComAcrescimo.map((c) => (
                  <LinhaCalc
                    key={c.chave}
                    label={`${c.nome} (+${numeroParaCampo(c.pct).replace(/,00$/, "")}%)`}
                    valor={fmt(precoNoCanal(round2(calc.precoSugerido), c.pct))}
                  />
                ))}
              </div>
            )}
            {noCadastro &&
              !encomendaTravada &&
              !calc.invalido &&
              canaisComAcrescimo.length === 0 && (
                <p className="mt-3 text-[12px] text-[var(--ink-soft)]">
                  Vende em marketplace com preço maior? Cadastre o acréscimo de cada canal em{" "}
                  <a
                    href="/produtos/anuncios"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--secondary-text)] hover:underline"
                  >
                    Marketplaces
                    <span className="sr-only"> (abre em outra aba)</span>
                  </a>{" "}
                  e o preço de cada um aparece aqui.
                </p>
              )}
            {/* Guardar é a ação principal (20/10/2026, GRW-66): 31 contas do Grátis
                calcularam e só 3 guardaram. O botão morava no fim da página, depois
                do simulador de desconto, e o preço calculado sumia ao sair. */}
            {modoPrimeiroPreco && (
              <BlocoPrimeiroPreco
                estado={primeiroPreco.estado}
                erro={primeiroPreco.erro}
                produtoId={primeiroPreco.produtoId}
                invalido={calc.invalido}
                nomeGuardado={primeiroPreco.nomeSalvo ?? nomeProvisorio(perfil)}
                rotuloCampoNome={
                  !primeiroPreco.nomeSalvo || primeiroPreco.nomeSalvo === nomeProvisorio(perfil)
                    ? perfil === "servico"
                      ? "Qual serviço?"
                      : "Qual produto?"
                    : null
                }
                onTentarDeNovo={primeiroPreco.tentarDeNovo}
                onCompletarCadastro={onCompletarCadastro}
                servico={perfil === "servico"}
              />
            )}
            {!encomendaTravada && noCadastro && (
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                {calc.invalido && (
                  <p id="calc-usar-motivo" className="mb-3 text-[13px] text-[var(--ink-soft)]">
                    Pra usar, resolva o aviso logo abaixo do preço.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (precoNaoSalvavel) return;
                    noCadastro.onUsar({
                      precoVenda: round2(calc.precoSugerido),
                      precoCusto: round2(custoBase) || null,
                      breakdown: buildBreakdown(),
                    });
                    setUsadoNoCadastro(true);
                    track("calculadora_usar_no_cadastro", { perfil });
                  }}
                  disabled={precoNaoSalvavel}
                  aria-describedby={calc.invalido ? "calc-usar-motivo" : undefined}
                  className={BTN_ACAO}
                >
                  Usar esse preço
                </button>
                <p className="mt-2 text-[12px] text-[var(--ink-soft)]" aria-live="polite">
                  {usadoNoCadastro
                    ? 'Preço de venda e custo preenchidos no cadastro. Só ficam guardados no "Salvar produto".'
                    : "Preenche o preço de venda e o custo do cadastro. Dá pra mudar à mão depois."}
                </p>
              </div>
            )}
            {!encomendaTravada && !modoPrimeiroPreco && !noCadastro && (
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                {calc.invalido && (
                  <p id="calc-salvar-motivo" className="mb-3 text-[13px] text-[var(--ink-soft)]">
                    Pra guardar, resolva o aviso logo abaixo do preço.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!produtoRecalcular) track("calculadora_guardar_clicado", { perfil });
                    void salvar();
                  }}
                  disabled={salvando || precoNaoSalvavel || (salvarBloqueado && !produtoRecalcular)}
                  aria-describedby={calc.invalido ? "calc-salvar-motivo" : undefined}
                  className={BTN_ACAO}
                >
                  {salvando
                    ? "Guardando..."
                    : produtoRecalcular
                      ? "Guardar o preço novo"
                      : "Guardar esse preço"}
                </button>
                {!produtoRecalcular && (
                  <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
                    O preço vai pro seu catálogo com o custo e o lucro, e o Painel passa a usar esse
                    número.
                  </p>
                )}
              </div>
            )}
            {!encomendaTravada && vendasParaMetaBoa !== null && (
              <p className="mt-4 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--ink-soft)]">
                Pra entrar a Meta do mês ({fmt(metaBoa!)}) só com esse produto: {vendasParaMetaBoa}{" "}
                {vendasParaMetaBoa === 1 ? "venda" : "vendas"} de {fmt(precoParaMeta)}.
              </p>
            )}
          </div>

          {/* Lucro por canal (VND-07): mesmo preço, taxa de cada canal. Fora da
              Encomenda travada (revelaria o preço) e sem conta válida. */}
          {!encomendaTravada && !calc.invalido && round2(calc.precoSugerido) > 0 && (
            <LucroPorCanal
              userId={userId}
              preco={round2(calc.precoSugerido)}
              custo={custoBase}
              impostosPct={impostosPctAtual}
              taxaContaPct={taxaVendaPctAtual}
            />
          )}

          {/* Simulador de desconto (fora da Encomenda travada: revelaria o preço) */}
          {!encomendaTravada && (
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
                  {fmt(round2(simulacaoDesconto.precoComDesconto))}
                  {simulacaoDesconto.prejuizo ? (
                    <>
                      {" "}
                      e cada venda fica {fmt(round2(-simulacaoDesconto.lucroComDesconto))} abaixo do
                      custo. Esse desconto dá prejuízo.
                    </>
                  ) : (
                    <>
                      {" "}
                      e a marca lucra {fmt(round2(simulacaoDesconto.lucroComDesconto))} em cada
                      venda.
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {erro && (
            <p role="alert" className="mt-4 text-[13px] text-[var(--danger)]">
              {erro}
            </p>
          )}
        </>
      )}

      <p className="mt-4 text-[13px] text-[var(--muted)]">
        Esses são valores de referência. Considere também o mercado e o posicionamento da sua marca.
      </p>
    </section>
  );
}

/**
 * Primeiro preço guardado sozinho (GRW-90, wireframe em cinza aprovado em
 * docs/plano-primeiro-preco-guardado.md). Fica no lugar do "Guardar esse
 * preço": esperando a conta parar, guardando, guardado (com o nome com que
 * ficou) ou erro com "Tentar de novo". Os números nunca saem da tela. O campo
 * do nome subiu pro topo da aba em 01/11/2026 ("Qual produto?").
 */
function BlocoPrimeiroPreco({
  estado,
  erro,
  produtoId,
  invalido,
  nomeGuardado,
  rotuloCampoNome,
  onTentarDeNovo,
  onCompletarCadastro,
  servico,
}: {
  /** Aba Serviço: o convite fala em pedido do serviço, não em encomenda. */
  servico: boolean;
  estado: EstadoPrimeiroPreco;
  erro: string | null;
  produtoId: string | null;
  invalido: boolean;
  /** O nome com que o produto fica no catálogo (o digitado ou o provisório). */
  nomeGuardado: string;
  /** Rótulo do campo do nome quando ficou o provisório, pra dizer onde trocar; null com nome digitado. */
  rotuloCampoNome: string | null;
  onTentarDeNovo: () => void;
  onCompletarCadastro?: (produtoId: string) => void;
}) {
  const guardado = produtoId !== null;

  let recado: ReactNode;
  if (estado === "erro" && erro) {
    recado = (
      <div role="alert">
        <p className="text-[13px] text-[var(--danger)]">{erro}</p>
        <button type="button" onClick={onTentarDeNovo} className={`${BTN_ACAO_CONTORNO} mt-3`}>
          Tentar de novo
        </button>
      </div>
    );
  } else if (invalido && !guardado) {
    recado = (
      <p className="text-[13px] text-[var(--ink-soft)]">
        Pra guardar, resolva o aviso logo abaixo do preço.
      </p>
    );
  } else if (!guardado) {
    recado = (
      <p className="text-[13px] text-[var(--ink-soft)]">
        {estado === "guardando"
          ? "Guardando esse preço..."
          : "Com a conta parada, a Pólia One guarda esse preço no seu catálogo."}
      </p>
    );
  } else {
    recado = (
      <p className="flex items-start gap-2 text-[14px] text-[var(--ink)]">
        <Check size={16} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0" />
        {estado === "guardando"
          ? "Atualizando o preço guardado..."
          : `A Pólia One guardou esse preço no catálogo como "${nomeGuardado}".${
              rotuloCampoNome ? ` O nome muda em "${rotuloCampoNome}", no topo.` : ""
            }`}
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-[var(--line)] pt-4">
      <div aria-live="polite">{recado}</div>
      {guardado && (
        <>
          {/* Ponte do preço pro pedido (ONE-249, 24/11/2026): desde 28/10, 19
              de 68 contas guardaram o primeiro preço e só 3 abriram Pedidos. O
              pedido é o que faz a conta voltar (véspera da entrega, quadro do
              dia), então ele vira a ação principal daqui. */}
          <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
            {servico
              ? "Próximo passo: lançar o primeiro pedido desse serviço, com a cliente e o dia. No quadro de Pedidos, a Pólia One mostra o que fazer e quando."
              : "Próximo passo: anotar a primeira encomenda desse produto, com a cliente e o dia da entrega. No quadro de Pedidos, a Pólia One mostra o que entregar e quando."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to="/pedidos"
              search={{ novo: true, produto: produtoId }}
              onClick={() => {
                track("primeiro_preco_para_pedido", { perfil: servico ? "servico" : "produto" });
              }}
              className={`${BTN_ACAO} no-underline`}
            >
              {servico ? "Lançar o primeiro pedido" : "Anotar a primeira encomenda"}
            </Link>
            {onCompletarCadastro && (
              <button
                type="button"
                onClick={() => onCompletarCadastro(produtoId)}
                className={BTN_ACAO_CONTORNO}
              >
                Completar o cadastro
              </button>
            )}
            <Link
              to="/produtos"
              className="text-[14px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
            >
              Ver no catálogo
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function CampoNum({
  label,
  value,
  onChange,
  dica,
  error,
  permiteNegativo = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dica?: string;
  error?: string;
  /** Só o "Quanto quer lucrar (%)": lucro negativo mostra o aviso de abaixo do piso. */
  permiteNegativo?: boolean;
}) {
  // Campo de texto desde 24/11/2026: type="number" lia "1.500" como 1,5.
  const erro = error ?? (numInvalido(value, permiteNegativo) ? "Coloque um número." : undefined);
  return (
    <Campo label={label} hint={dica} error={erro}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(normalizarDigitado(e.target.value))}
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
