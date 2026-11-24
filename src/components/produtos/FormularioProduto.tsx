import { useState, type ReactNode } from "react";
import { ArrowLeft, Calculator, ImageUp, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { hojeISO } from "@/lib/data.functions";
import { temVitrine } from "@/lib/planos";
import { useUserMeta } from "@/hooks/useUserMeta";
import { FOTO_TIPOS, MAX_FOTOS_PRODUTO } from "@/lib/loja";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { avisarAtivacaoNoGA } from "@/lib/ativacaoPreco";
import { sobraDoProduto, type CalculadoraBreakdown } from "@/lib/precificacao.functions";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { toastErro } from "@/lib/toast";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import {
  fmt,
  normalizarDigitado,
  num,
  numInvalido,
  type Prefill,
  type Produto,
  type ProdutoTipo,
} from "./tipos";
import { EstoqueDoProduto } from "./EstoqueDoProduto";
import { useEstoqueDoProduto } from "./useEstoqueDoProduto";
import { KitDoProduto } from "./KitDoProduto";
import { useKitDoProduto } from "./useKitDoProduto";
import { useFotosDoProduto } from "./useFotosDoProduto";
import { NaLojaDoProduto } from "./NaLojaDoProduto";
import { CategoriaDaVitrine } from "./CategoriaDaVitrine";
import { useLojaDoProduto } from "./useLojaDoProduto";
import { Calculadora } from "./Calculadora";
import { useDadosDaCalculadora } from "./useDadosDaCalculadora";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

/**
 * Cadastro de produto (adicionar e editar). Desde 24/11/2026 (ONE-254) mora
 * em dois lugares com a mesma lógica:
 * - `casca="pagina"`: /produtos/novo e /produtos/$produtoId, em duas colunas,
 *   com a Calculadora aberta dentro da seção Preço. É o caminho da lista.
 * - `casca="janela"`: a janela de sempre, que a Calculadora avulsa ainda usa
 *   no "Guardar esse preço" a partir do segundo produto.
 */
export function FormularioProduto({
  userId,
  prefill,
  produtoEdit,
  onClose,
  onSaved,
  casca,
  calculadoraAberta = false,
  bloqueadoPorCota,
}: {
  userId: string;
  prefill: Prefill | null;
  produtoEdit: Produto | null;
  onClose: () => void;
  onSaved: () => void;
  casca: "janela" | "pagina";
  /** Página aberta pelo "Recalcular preço": a calculadora já vem aberta. */
  calculadoraAberta?: boolean;
  /** Produto novo com o catálogo do Grátis cheio: mostra o aviso e não salva. */
  bloqueadoPorCota?: ReactNode;
}) {
  const edit = !!produtoEdit;
  // Só monta depois de um clique ou na página já no navegador, então window existe.
  const [focoAutomatico] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches === true,
  );

  const [nome, setNome] = useState(produtoEdit?.nome ?? prefill?.nome ?? "");
  const [tipo, setTipo] = useState<ProdutoTipo>(
    (produtoEdit?.tipo as ProdutoTipo) ?? prefill?.tipo ?? "fisico",
  );
  const fotos = useFotosDoProduto(userId, produtoEdit?.id ?? null, produtoEdit?.foto_url ?? null);
  const [fotoAviso, setFotoAviso] = useState<string | null>(null);
  const [precoVenda, setPrecoVenda] = useState(
    produtoEdit?.preco_venda != null
      ? String(produtoEdit.preco_venda)
      : prefill?.preco_venda != null
        ? String(prefill.preco_venda)
        : "",
  );
  // Preço promocional (ONE-239): o "por". Preenchido e menor que o preço de
  // venda, vira o preço que vale em todo o sistema (precoQueVale). Vazio = sem.
  const promocionalInicial =
    produtoEdit?.preco_promocional != null ? String(produtoEdit.preco_promocional) : "";
  const [precoPromocional, setPrecoPromocional] = useState(promocionalInicial);
  const [precoCusto, setPrecoCusto] = useState(
    produtoEdit?.preco_custo != null
      ? String(produtoEdit.preco_custo)
      : prefill?.preco_custo != null
        ? String(prefill.preco_custo)
        : "",
  );
  // Composição da conta da Calculadora (ONE-254): vem do produto ou do prefill
  // e muda no "Usar esse preço". Na edição só grava quando mudou aqui.
  const [breakdown, setBreakdown] = useState<CalculadoraBreakdown | null>(
    produtoEdit?.calculadora_breakdown ?? prefill?.calculadora_breakdown ?? null,
  );
  const [breakdownMudou, setBreakdownMudou] = useState(false);
  const [calculando, setCalculando] = useState(calculadoraAberta);
  const [descricao, setDescricao] = useState(produtoEdit?.descricao ?? "");
  const [observacaoInterna, setObservacaoInterna] = useState(produtoEdit?.observacao_interna ?? "");
  const [canal, setCanal] = useState(produtoEdit?.canal ?? "");
  const estoque = useEstoqueDoProduto(
    produtoEdit?.id ?? null,
    produtoEdit?.controla_estoque ?? false,
  );
  // Kit e combo (ONE-132): kit não tem estoque próprio, a venda baixa os itens.
  const kit = useKitDoProduto(userId, produtoEdit?.id ?? null);
  const ehKit = tipo === "fisico" && kit.estado.ehKit;
  // Loja de marca (ONE-181): quem tem loja cadastra variação pela seção Na loja.
  const loja = useLojaDoProduto(
    userId,
    produtoEdit?.id ?? null,
    produtoEdit?.controla_estoque ?? false,
  );
  // Vitrine online (Premium e Pro): ligar o produto na loja mora aqui, junto do cadastro
  // (pedido da Sil, 22/11/2026). Desde 24/11 (ONE-239) a categoria também: a lista de
  // produtos saiu da tela da Vitrine. A ordem fica na coluna Ordem de Produtos.
  const meta = useUserMeta();
  const ehPro = temVitrine(meta.plano);
  const [naVitrine, setNaVitrine] = useState(produtoEdit?.no_catalogo ?? false);
  const [categoriaVitrine, setCategoriaVitrine] = useState(produtoEdit?.categoria_id ?? "");
  // Com a Loja da marca, a categoria é a do bloco "Na loja" (mesma coluna).
  const gravaCategoriaVitrine = ehPro && naVitrine && !loja.carregando && !loja.temLoja;
  const [usaPaleta, setUsaPaleta] = useState(produtoEdit?.usa_paleta ?? false);
  const [corDaFoto, setCorDaFoto] = useState(produtoEdit?.cor_da_foto ?? "");
  const [maxCores, setMaxCores] = useState(produtoEdit?.max_cores ?? 1);
  const [sobConsulta, setSobConsulta] = useState({
    preco: produtoEdit?.preco_sob_consulta ?? false,
    cor: produtoEdit?.cor_sob_consulta ?? false,
    tamanho: produtoEdit?.tamanho_sob_consulta ?? false,
  });
  const [prontaEntrega, setProntaEntrega] = useState(produtoEdit?.pronta_entrega ?? false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precoVendaNum = num(precoVenda);
  // Kit com todos os itens custeados: o custo é a soma, a mesma conta que a
  // venda faz no banco (custo_do_item). Com item sem custo, vale o digitado.
  const custoSomado = ehKit ? kit.custo : null;
  const precoCustoNum =
    custoSomado != null ? custoSomado : precoCusto.trim() ? num(precoCusto) : null;
  const precosInvalidos =
    numInvalido(precoVenda) || numInvalido(precoPromocional) || numInvalido(precoCusto);
  const podeSalvar =
    nome.trim().length > 0 && precoVendaNum > 0 && !precosInvalidos && !bloqueadoPorCota;

  /** Kit ligado: grava os itens (e desliga o estoque próprio). Senão, o estoque. */
  const salvarEstoqueOuKit = async (id: string): Promise<string | null> => {
    if (ehKit) {
      const erroDoKit = await kit.salvar(id);
      if (erroDoKit || !loja.temLoja) return erroDoKit;
      return loja.salvar(id, true);
    }
    // Era kit e deixou de ser (ou virou serviço/digital): desfaz o kit antes,
    // porque o banco não deixa kit ligar estoque próprio.
    const erroKit = await kit.salvar(id, true);
    if (erroKit) return erroKit;
    return loja.temLoja ? loja.salvar(id, false) : estoque.salvar(id);
  };

  const salvar = async () => {
    if (!podeSalvar) return;
    // O botão fica ligado e o motivo aparece no clique: botão apagado sem
    // explicação deixava a pessoa procurando o que faltava.
    if (ehKit && kit.erro) {
      setErro(kit.erro);
      return;
    }
    const problemaDaLoja = loja.problemaPara(ehKit);
    if (problemaDaLoja) {
      setErro(problemaDaLoja);
      return;
    }
    if (
      precoPromocional.trim() &&
      !(num(precoPromocional) > 0 && num(precoPromocional) < precoVendaNum)
    ) {
      setErro(
        "O preço promocional precisa ser menor que o preço de venda. Deixe vazio pra vender sem promoção.",
      );
      return;
    }
    setSalvando(true);
    setErro(null);

    if (edit && produtoEdit) {
      const gravadas = await fotos.salvar(produtoEdit.id);
      if (gravadas.erro) {
        setSalvando(false);
        setErro(gravadas.erro);
        return;
      }
      const update: Record<string, unknown> = {
        nome: nome.trim(),
        tipo,
        foto_url: gravadas.fotoUrl,
        preco_venda: precoVendaNum,
        preco_custo: precoCustoNum,
        descricao: descricao.trim() || null,
        observacao_interna: observacaoInterna.trim() || null,
        canal: canal.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (ehPro) {
        update.no_catalogo = naVitrine;
        update.usa_paleta = usaPaleta;
        update.cor_da_foto = corDaFoto.trim().slice(0, 60) || null;
        update.max_cores = maxCores;
        update.preco_sob_consulta = sobConsulta.preco;
        update.cor_sob_consulta = sobConsulta.cor;
        update.tamanho_sob_consulta = sobConsulta.tamanho;
        update.pronta_entrega = prontaEntrega;
      }
      // Só grava se mudou: quem abre o cadastro sem a coluna (Calculadora) não apaga a categoria.
      if (gravaCategoriaVitrine && categoriaVitrine !== (produtoEdit.categoria_id ?? ""))
        update.categoria_id = categoriaVitrine || null;
      // Mesma trava: só grava o promocional quando ele mudou nesta janela.
      if (precoPromocional !== promocionalInicial)
        update.preco_promocional = precoPromocional.trim() ? num(precoPromocional) : null;
      // A composição só muda quando ela usou a Calculadora aqui.
      if (breakdownMudou) update.calculadora_breakdown = breakdown as unknown as Json;

      // Histórico de preço: só registra quando o preço de venda mudou.
      if (Number(produtoEdit.preco_venda) !== precoVendaNum) {
        const atual = Array.isArray(produtoEdit.historico_precos)
          ? produtoEdit.historico_precos
          : [];
        update.historico_precos = [
          { preco: Number(produtoEdit.preco_venda), data: hojeISO() },
          ...atual,
        ] as unknown as Json;
        update.preco_atualizado_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from("produtos")
        .update(update as never)
        .eq("id", produtoEdit.id);
      if (error) {
        setSalvando(false);
        console.error("produto_salvar", error);
        setErro("A Pólia One não conseguiu salvar o produto. Tenta de novo.");
        return;
      }
      const erroEstoque = await salvarEstoqueOuKit(produtoEdit.id);
      setSalvando(false);
      if (erroEstoque) {
        setErro(erroEstoque);
        return;
      }
      void registrar("edit_product", { feature: "produtos", propriedades: { tipo } });
      if (breakdownMudou) track("produto_preco_recalculado");
    } else {
      const { data: criado, error } = await supabase
        .from("produtos")
        .insert({
          user_id: userId,
          nome: nome.trim(),
          tipo,
          foto_url: fotos.link.trim() || null,
          preco_venda: precoVendaNum,
          preco_custo: precoCustoNum,
          descricao: descricao.trim() || null,
          observacao_interna: observacaoInterna.trim() || null,
          canal: canal.trim() || null,
          calculadora_breakdown: breakdown,
          ...(ehPro
            ? {
                no_catalogo: naVitrine,
                usa_paleta: usaPaleta,
                cor_da_foto: corDaFoto.trim().slice(0, 60) || null,
                max_cores: maxCores,
                preco_sob_consulta: sobConsulta.preco,
                cor_sob_consulta: sobConsulta.cor,
                tamanho_sob_consulta: sobConsulta.tamanho,
                pronta_entrega: prontaEntrega,
              }
            : {}),
          ...(gravaCategoriaVitrine ? { categoria_id: categoriaVitrine || null } : {}),
          ...(precoPromocional.trim() ? { preco_promocional: num(precoPromocional) } : {}),
        } as never)
        .select("id")
        .single();
      if (error || !criado) {
        setSalvando(false);
        console.error("produto_salvar", error);
        setErro("A Pólia One não conseguiu salvar o produto. Tenta de novo.");
        return;
      }
      const gravadas = await fotos.salvar(criado.id);
      if (!gravadas.erro && gravadas.fotoUrl) {
        await supabase
          .from("produtos")
          .update({ foto_url: gravadas.fotoUrl } as never)
          .eq("id", criado.id);
      }
      const erroEstoque = await salvarEstoqueOuKit(criado.id);
      setSalvando(false);
      if (gravadas.erro) toastErro(`O produto foi salvo, mas as fotos não. ${gravadas.erro}`);
      if (erroEstoque) {
        // O produto já existe: ficar no cadastro duplicaria no próximo "Salvar".
        toastErro(
          ehKit
            ? `O produto foi salvo, mas os itens do kit não. ${erroEstoque}`
            : `O produto foi salvo, mas o estoque não. ${erroEstoque}`,
        );
        onSaved();
        return;
      }
      track("produto_criado", { tipo });
      void registrar("create_product", { feature: "produtos", propriedades: { tipo } });
      if (breakdown) void avisarAtivacaoNoGA(userId, precoCustoNum !== null);
    }
    onSaved();
  };

  const usarPrecoDaCalculadora = (r: {
    precoVenda: number;
    precoCusto: number | null;
    breakdown: CalculadoraBreakdown;
  }) => {
    setPrecoVenda(String(r.precoVenda));
    if (custoSomado == null) setPrecoCusto(r.precoCusto != null ? String(r.precoCusto) : "");
    setBreakdown(r.breakdown);
    setBreakdownMudou(true);
  };

  // ───────── Blocos (a janela empilha; a página arruma em seções) ─────────

  const campoNome = (
    <Campo label="Nome" required>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className={INPUT}
        placeholder="ex: Camiseta bordada"
        // No celular, foco automático abre o teclado por cima e o botão
        // "Salvar produto" some embaixo dele (09/10/2026). Só no mouse.
        autoFocus={focoAutomatico}
      />
    </Campo>
  );

  const campoTipo = (
    <div>
      <p id="produto-tipo-rotulo" className="mb-1 block text-[12px] text-[var(--muted)]">
        Tipo
      </p>
      <div role="group" aria-labelledby="produto-tipo-rotulo" className="flex flex-wrap gap-2">
        {(
          [
            { id: "fisico", label: "Produto físico" },
            { id: "digital", label: "Produto digital" },
            { id: "servico", label: "Serviço" },
          ] as { id: ProdutoTipo; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tipo === t.id}
            onClick={() => setTipo(t.id)}
            className={`${BTN_MIUDO} ${tipo === t.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Fotos: até 4, as mesmas da loja (produto_fotos). A primeira é a da vitrine.
  const campoFotos = (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-[var(--ink)]">Fotos</p>
      <ul className="grid grid-cols-4 gap-2 sm:max-w-[440px]" aria-label="Fotos do produto">
        {fotos.itens.map((f, i) => (
          <li key={f.chave} className="relative">
            <div className="aspect-square overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg)]">
              <img
                src={f.url}
                alt={`Foto ${i + 1} do produto`}
                className="h-full w-full object-cover"
              />
            </div>
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink)]">
                Vitrine
              </span>
            )}
            <button
              type="button"
              onClick={() => fotos.tirar(f.chave)}
              aria-label={`Tirar a foto ${i + 1}`}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
        {fotos.itens.length < MAX_FOTOS_PRODUTO && (
          <li>
            <input
              type="file"
              multiple
              accept={FOTO_TIPOS.join(",")}
              className="peer sr-only"
              id="arquivo-foto-produto"
              aria-describedby="fotos-produto-dica"
              onChange={(e) => {
                setFotoAviso(fotos.adicionar(Array.from(e.target.files ?? [])));
                e.target.value = "";
              }}
            />
            <label
              htmlFor="arquivo-foto-produto"
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] text-center text-[12px] text-[var(--muted)] hover:border-[var(--secondary-text)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--secondary-text)]"
            >
              <ImageUp size={18} aria-hidden="true" />
              {fotos.itens.length ? "Mais uma foto" : "Enviar foto"}
            </label>
          </li>
        )}
      </ul>
      <p id="fotos-produto-dica" className="mt-1.5 text-[12.5px] text-[var(--muted)]">
        Até 4 fotos, em JPG, PNG ou WEBP de até 3 MB. A primeira é a da vitrine e as fotos entram ao
        salvar.
      </p>
      {fotoAviso && (
        <p role="alert" className="mt-1 text-[12.5px] text-[var(--danger)]">
          {fotoAviso}
        </p>
      )}
      {fotos.itens.length === 0 && (
        <div className="mt-3">
          <Campo label="Ou cole o link de uma imagem" hint="opcional">
            <input
              value={fotos.link}
              onChange={(e) => fotos.setLink(e.target.value)}
              className={INPUT}
              placeholder="https://..."
            />
          </Campo>
        </div>
      )}
    </div>
  );

  // Desde 24/11/2026 os preços são campos de texto: "1.500" é mil e quinhentos
  // (type="number" lia 1,5), igual à Calculadora.
  const campoPrecoVenda = (
    <Campo
      label="Preço de venda (R$)"
      required
      error={numInvalido(precoVenda) ? "Coloque um número." : undefined}
    >
      <input
        type="text"
        inputMode="decimal"
        value={precoVenda}
        onChange={(e) => setPrecoVenda(normalizarDigitado(e.target.value))}
        className={INPUT}
        placeholder="0"
      />
    </Campo>
  );

  // Preço promocional (ONE-239): entre o preço de venda e o custo, pedido da Sil
  const campoPromocional = (
    <Campo
      label="Preço promocional (R$)"
      hint="Opcional. Preenchido, é o preço que a cliente paga em todo o sistema, e a vitrine mostra o preço de venda riscado. Vazio, vale o preço de venda."
      error={numInvalido(precoPromocional) ? "Coloque um número." : undefined}
    >
      <input
        type="text"
        inputMode="decimal"
        value={precoPromocional}
        onChange={(e) => setPrecoPromocional(normalizarDigitado(e.target.value))}
        className={INPUT}
        placeholder="Sem promoção"
      />
    </Campo>
  );

  const campoCusto = (
    <Campo
      label={ehKit ? "Custo do kit (R$)" : "Custo de produção (R$)"}
      hint={
        !ehKit
          ? undefined
          : custoSomado != null
            ? `Nas vendas, a Pólia One usa a soma dos itens: ${fmt(custoSomado)}. Pra mudar, mude o custo de cada item.`
            : "Enquanto algum item estiver sem custo, as vendas usam este valor."
      }
      error={custoSomado == null && numInvalido(precoCusto) ? "Coloque um número." : undefined}
    >
      <input
        type="text"
        inputMode="decimal"
        value={custoSomado != null ? String(custoSomado) : precoCusto}
        readOnly={custoSomado != null}
        onChange={(e) => setPrecoCusto(normalizarDigitado(e.target.value))}
        className={`${INPUT} read-only:bg-[var(--surface)]`}
        placeholder="0"
      />
    </Campo>
  );

  const campoDescricao = (
    <Campo label="Descrição curta">
      <input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className={INPUT}
        placeholder="ex: algodão pima, tamanho único"
      />
    </Campo>
  );

  // Observação interna (ONE-120): código, fornecedor, o que ela precisar
  const campoObservacao = (
    <Campo
      label="Observação interna"
      hint="Só aparece pra você, aqui no cadastro. Bom pra código do produto e dados do fornecedor."
    >
      <textarea
        value={observacaoInterna}
        onChange={(e) => setObservacaoInterna(e.target.value)}
        maxLength={2000}
        rows={3}
        className={`${INPUT} resize-y`}
        placeholder="ex: cód. CAM-014 · Malharia Sol, (11) 9999-0000, pedido mínimo 20 peças"
      />
    </Campo>
  );

  const blocoVitrine = ehPro && (
    <div className="rounded-xl border border-[var(--line)] p-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]">
        <input
          type="checkbox"
          checked={naVitrine}
          onChange={(e) => setNaVitrine(e.target.checked)}
          aria-describedby="produto-vitrine-ajuda"
          className="h-4 w-4 accent-[var(--secondary-text)]"
        />
        Mostrar na Vitrine online
      </label>
      <p id="produto-vitrine-ajuda" className="text-[12px] text-[var(--muted)]">
        A primeira foto é a da vitrine. A ordem fica na coluna Ordem da lista de Produtos.
      </p>
      {naVitrine && (
        <div
          role="radiogroup"
          aria-label="Como o produto sai na vitrine"
          className="mt-3 flex flex-wrap gap-x-6 border-t border-[var(--line)] pt-3"
        >
          {[
            { v: false, rotulo: "Sob encomenda", ajuda: "usa o prazo de produção da loja" },
            {
              v: true,
              rotulo: "Pronta entrega",
              ajuda: "sai depois da confirmação; com estoque ligado, esgota quando acaba",
            },
          ].map((o) => (
            <label
              key={o.rotulo}
              className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-[var(--ink)]"
            >
              <input
                type="radio"
                name="produto-tipo-entrega"
                checked={prontaEntrega === o.v}
                onChange={() => setProntaEntrega(o.v)}
                className="h-4 w-4 accent-[var(--secondary-text)]"
              />
              <span>
                {o.rotulo} <span className="text-[12px] text-[var(--muted)]">({o.ajuda})</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {gravaCategoriaVitrine && (
        <CategoriaDaVitrine
          userId={userId}
          valor={categoriaVitrine}
          onMudar={setCategoriaVitrine}
        />
      )}
      {naVitrine && (
        <>
          <fieldset className="mt-3 border-t border-[var(--line)] pt-3">
            <legend className="pt-3 text-[13px] font-medium text-[var(--ink)]">
              Sob consulta na vitrine
            </legend>
            {(
              [
                ["preco", "Preço sob consulta"],
                ["cor", "Cor sob consulta"],
                ["tamanho", "Tamanho sob consulta"],
              ] as const
            ).map(([chave, rotulo]) => (
              <label
                key={chave}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]"
              >
                <input
                  type="checkbox"
                  checked={sobConsulta[chave]}
                  onChange={(e) => setSobConsulta((s) => ({ ...s, [chave]: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--secondary-text)]"
                />
                {rotulo}
              </label>
            ))}
            <p className="text-[12px] text-[var(--muted)]">
              Preço sob consulta tira o preço e o carrinho: a cliente fala com você pelo WhatsApp.
              Cor e tamanho sob consulta deixam pôr no carrinho e o pedido chega avisando que falta
              combinar. Cor sob consulta esconde a paleta desse produto.
            </p>
          </fieldset>
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={usaPaleta}
                onChange={(e) => setUsaPaleta(e.target.checked)}
                aria-describedby="produto-paleta-ajuda"
                className="h-4 w-4 accent-[var(--secondary-text)]"
              />
              A cliente escolhe a cor da paleta da loja
            </label>
            <p id="produto-paleta-ajuda" className="text-[12px] text-[var(--muted)]">
              A paleta fica em Vitrine online. Na loja, as cores aparecem no lugar das variações; o
              estoque, se ligado, é o do produto, sem separar por cor.
            </p>
            {usaPaleta && (
              <div className="mt-2 grid gap-2">
                <Campo label="Quantas cores a cliente pode escolher">
                  <select
                    value={maxCores}
                    onChange={(e) => setMaxCores(Number(e.target.value))}
                    aria-describedby="produto-max-cores-ajuda"
                    className={`${INPUT} bg-white`}
                  >
                    <option value={1}>Uma cor só</option>
                    <option value={2}>Até 2 cores misturadas</option>
                    <option value={3}>Até 3 cores misturadas</option>
                  </select>
                </Campo>
                <p id="produto-max-cores-ajuda" className="-mt-1 text-[12px] text-[var(--muted)]">
                  Na página do produto, a cliente marca uma cor ou mistura até esse número, e o
                  pedido chega com as cores na ordem que ela escolheu.
                </p>
                <Campo label="Cor da foto (opcional)">
                  <input
                    value={corDaFoto}
                    onChange={(e) => setCorDaFoto(e.target.value)}
                    maxLength={60}
                    className={INPUT}
                    placeholder="ex: Preto e branco"
                  />
                </Campo>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const blocoKitEstoque = (
    <>
      {tipo === "fisico" && <KitDoProduto produtoId={produtoEdit?.id ?? null} kit={kit} />}
      {tipo !== "fisico" && kit.eraKit && (
        <p className="mb-4 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
          Kit só existe em produto físico. Salvando assim, os itens do kit saem.
        </p>
      )}
      {loja.temLoja && <NaLojaDoProduto loja={loja} ehKit={ehKit} />}
      {!ehKit && !loja.temLoja && (
        <EstoqueDoProduto
          estado={estoque.estado}
          onMudar={estoque.setEstado}
          carregando={estoque.carregando}
          tipo={tipo}
        />
      )}
    </>
  );

  const campoCanal = (
    <Campo label="Onde a compra acontece">
      <input
        value={canal}
        onChange={(e) => setCanal(e.target.value)}
        className={INPUT}
        placeholder="ex: DM do Instagram, link de pagamento"
      />
    </Campo>
  );

  const mensagemErro = erro && (
    <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
      {erro}
    </p>
  );

  const desabilitarSalvar =
    salvando || fotos.carregando || loja.carregando || loja.erroAoCarregar || !podeSalvar;
  const botoes = (
    <>
      <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
        Cancelar
      </button>
      <button type="button" onClick={salvar} disabled={desabilitarSalvar} className={BTN_ACAO}>
        {salvando ? "Salvando..." : "Salvar produto"}
      </button>
    </>
  );

  // ───────── Janela (a de sempre) ─────────
  if (casca === "janela") {
    return (
      <Modal
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={edit ? "Editar produto" : "Adicionar produto"}
        footer={botoes}
      >
        <div className="mb-4">{campoNome}</div>
        <div className="mb-4">{campoTipo}</div>
        <div className="mb-4">{campoFotos}</div>
        <div className="mb-4">{campoPrecoVenda}</div>
        <div className="mb-4">{campoPromocional}</div>
        <div className="mb-4">{campoCusto}</div>
        <div className="mb-4">{campoDescricao}</div>
        <div className="mb-4">{campoObservacao}</div>
        {blocoVitrine && <div className="mb-4">{blocoVitrine}</div>}
        {blocoKitEstoque}
        <div>{campoCanal}</div>
        {mensagemErro}
      </Modal>
    );
  }

  // ───────── Página (ONE-254) ─────────
  const precoQueVale =
    num(precoPromocional) > 0 && num(precoPromocional) < precoVendaNum
      ? num(precoPromocional)
      : precoVendaNum;
  const sobra = sobraDoProduto({ precoVenda: precoQueVale, precoCusto: precoCustoNum, breakdown });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/produtos"
          className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar pros produtos
        </Link>
        <div className="flex flex-wrap gap-2">{botoes}</div>
      </div>

      {bloqueadoPorCota && <div className="mb-6">{bloqueadoPorCota}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <Secao titulo="O produto">
            {campoNome}
            {campoTipo}
            {campoFotos}
            {campoDescricao}
            {campoObservacao}
          </Secao>

          <Secao
            titulo="Preço"
            acao={
              <button
                type="button"
                onClick={() => setCalculando((c) => !c)}
                aria-expanded={calculando}
                aria-controls="produto-calculadora"
                className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-[var(--secondary-text)] hover:underline"
              >
                <Calculator size={16} aria-hidden="true" />
                {calculando ? "Fechar a calculadora" : "Calcular o preço"}
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {campoPrecoVenda}
              {campoCusto}
              {campoPromocional}
            </div>
            {!calculando && (
              <p className="text-[12.5px] text-[var(--muted)]">
                Já tem o preço? É só preencher. Pra fazer a conta com os custos, as taxas e o lucro,
                use "Calcular o preço".
              </p>
            )}
            {calculando && (
              <div
                id="produto-calculadora"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4"
              >
                <CalculadoraNoCadastro
                  userId={userId}
                  breakdownInicial={breakdown}
                  perfilInicial={tipo === "servico" ? "servico" : "produto"}
                  onUsar={usarPrecoDaCalculadora}
                />
              </div>
            )}
          </Secao>

          {blocoVitrine && <Secao titulo="Vitrine online">{blocoVitrine}</Secao>}

          <Secao titulo="Estoque">{blocoKitEstoque}</Secao>

          <Secao titulo="Venda">{campoCanal}</Secao>

          {mensagemErro}
          <div className="flex flex-wrap justify-end gap-2">{botoes}</div>
        </div>

        <aside
          aria-labelledby="resumo-preco-titulo"
          className="h-fit rounded-xl border border-[var(--line)] bg-white p-5 lg:sticky lg:top-6"
        >
          <h2
            id="resumo-preco-titulo"
            className="font-cabinet text-[18px] tracking-[-0.02em] text-[var(--ink)]"
          >
            Resumo do preço
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">O que fica salvo neste produto.</p>
          <dl className="mt-4 space-y-2 text-[13px] text-[var(--ink-soft)]">
            <LinhaResumo
              rotulo="A cliente paga"
              valor={precoVendaNum > 0 ? fmt(precoQueVale) : "R$ --"}
            />
            <LinhaResumo
              rotulo="Custo"
              valor={precoCustoNum != null ? fmt(precoCustoNum) : "sem custo"}
            />
            {sobra && breakdown && (
              <LinhaResumo
                rotulo="Taxas e impostos"
                valor={fmt(precoQueVale - (precoCustoNum ?? 0) - sobra.valor)}
              />
            )}
            <LinhaResumo
              rotulo="Lucro da marca"
              valor={sobra ? `${fmt(sobra.valor)} (${sobra.pct}%)` : "R$ --"}
              forte
            />
          </dl>
          <p className="mt-3 text-[12px] text-[var(--muted)]">
            {!sobra
              ? "Com preço de venda e custo preenchidos, o lucro aparece aqui."
              : sobra.prejuizo
                ? "Esse preço fica abaixo do custo. Cada venda sai do bolso."
                : breakdown
                  ? "Taxa e imposto vêm da conta da calculadora."
                  : "Sem a calculadora, taxa e imposto não entram nessa conta."}
          </p>
        </aside>
      </div>
    </div>
  );
}

/** A Calculadora dentro do cadastro, com os mesmos atalhos da avulsa. */
function CalculadoraNoCadastro({
  userId,
  breakdownInicial,
  perfilInicial,
  onUsar,
}: {
  userId: string;
  breakdownInicial: CalculadoraBreakdown | null;
  perfilInicial: "produto" | "servico";
  onUsar: (r: {
    precoVenda: number;
    precoCusto: number | null;
    breakdown: CalculadoraBreakdown;
  }) => void;
}) {
  const dados = useDadosDaCalculadora(userId);
  // A composição inicial só vale na montagem: guardar a primeira evita a
  // calculadora "pular" depois do "Usar esse preço".
  const [inicial] = useState(breakdownInicial);
  if (dados.carregando) {
    return <p className="text-[14px] text-[var(--muted)]">Abrindo a calculadora...</p>;
  }
  return (
    <Calculadora
      onSalvarComoProduto={() => {}}
      metaBoa={dados.metaBoa}
      userId={userId}
      ehProjete={dados.ehProjete}
      valorHoraPadrao={dados.valorHoraPadrao}
      valorHoraPadraoCarregando={dados.valorHoraPadraoCarregando}
      fixosDoFinanceiro={dados.fixosDoFinanceiro}
      reservaEquipamentos={dados.reservaEquipamentos}
      noCadastro={{ breakdownInicial: inicial, perfilInicial, onUsar }}
    />
  );
}

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  const id = `secao-${titulo.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="font-cabinet text-[18px] tracking-[-0.02em] text-[var(--ink)]">
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function LinhaResumo({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{rotulo}</dt>
      <dd className={`text-right ${forte ? "font-medium text-[var(--ink)]" : "text-[var(--ink)]"}`}>
        {valor}
      </dd>
    </div>
  );
}
