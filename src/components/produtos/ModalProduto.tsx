import { useState } from "react";
import { hojeISO } from "@/lib/data.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { gtagEvent } from "@/lib/gtag";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { toastErro } from "@/lib/toast";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { fmt, num, type Prefill, type Produto, type ProdutoTipo } from "./tipos";
import { EstoqueDoProduto } from "./EstoqueDoProduto";
import { useEstoqueDoProduto } from "./useEstoqueDoProduto";
import { KitDoProduto } from "./KitDoProduto";
import { useKitDoProduto } from "./useKitDoProduto";

/* ============== Modal: adicionar/editar produto ============== */
export function ModalProduto({
  userId,
  prefill,
  produtoEdit,
  onClose,
  onSaved,
}: {
  userId: string;
  prefill: Prefill | null;
  produtoEdit: Produto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!produtoEdit;
  // O modal só monta depois de um clique (nunca no SSR), então window existe.
  const [focoAutomatico] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches === true,
  );

  const [nome, setNome] = useState(produtoEdit?.nome ?? prefill?.nome ?? "");
  const [tipo, setTipo] = useState<ProdutoTipo>(
    (produtoEdit?.tipo as ProdutoTipo) ?? prefill?.tipo ?? "fisico",
  );
  const [fotoUrl, setFotoUrl] = useState(produtoEdit?.foto_url ?? "");
  const [precoVenda, setPrecoVenda] = useState(
    produtoEdit?.preco_venda != null
      ? String(produtoEdit.preco_venda)
      : prefill?.preco_venda != null
        ? String(prefill.preco_venda)
        : "",
  );
  const [precoCusto, setPrecoCusto] = useState(
    produtoEdit?.preco_custo != null
      ? String(produtoEdit.preco_custo)
      : prefill?.preco_custo != null
        ? String(prefill.preco_custo)
        : "",
  );
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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precoVendaNum = num(precoVenda);
  // Kit com todos os itens custeados: o custo é a soma, a mesma conta que a
  // venda faz no banco (custo_do_item). Com item sem custo, vale o digitado.
  const custoSomado = ehKit ? kit.custo : null;
  const precoCustoNum =
    custoSomado != null ? custoSomado : precoCusto.trim() ? num(precoCusto) : null;
  const podeSalvar = nome.trim().length > 0 && precoVendaNum > 0;

  /** Kit ligado: grava os itens (e desliga o estoque próprio). Senão, o estoque. */
  const salvarEstoqueOuKit = async (id: string): Promise<string | null> => {
    if (ehKit) return kit.salvar(id);
    // Era kit e deixou de ser (ou virou serviço/digital): desfaz o kit antes,
    // porque o banco não deixa kit ligar estoque próprio.
    const erroKit = await kit.salvar(id, true);
    if (erroKit) return erroKit;
    return estoque.salvar(id);
  };

  const salvar = async () => {
    if (!podeSalvar) return;
    // O botão fica ligado e o motivo aparece no clique: botão apagado sem
    // explicação deixava a pessoa procurando o que faltava.
    if (ehKit && kit.erro) {
      setErro(kit.erro);
      return;
    }
    setSalvando(true);
    setErro(null);

    if (edit && produtoEdit) {
      const update: Record<string, unknown> = {
        nome: nome.trim(),
        tipo,
        foto_url: fotoUrl.trim() || null,
        preco_venda: precoVendaNum,
        preco_custo: precoCustoNum,
        descricao: descricao.trim() || null,
        observacao_interna: observacaoInterna.trim() || null,
        canal: canal.trim() || null,
        updated_at: new Date().toISOString(),
      };

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
    } else {
      const { data: criado, error } = await supabase
        .from("produtos")
        .insert({
          user_id: userId,
          nome: nome.trim(),
          tipo,
          foto_url: fotoUrl.trim() || null,
          preco_venda: precoVendaNum,
          preco_custo: precoCustoNum,
          descricao: descricao.trim() || null,
          observacao_interna: observacaoInterna.trim() || null,
          canal: canal.trim() || null,
          calculadora_breakdown: prefill?.calculadora_breakdown ?? null,
        } as never)
        .select("id")
        .single();
      if (error || !criado) {
        setSalvando(false);
        console.error("produto_salvar", error);
        setErro("A Pólia One não conseguiu salvar o produto. Tenta de novo.");
        return;
      }
      const erroEstoque = await salvarEstoqueOuKit(criado.id);
      setSalvando(false);
      if (erroEstoque) {
        // O produto já existe: ficar no modal duplicaria no próximo "Salvar".
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
      if (prefill?.calculadora_breakdown) void avisarAtivacaoNoGA(userId, precoCustoNum !== null);
    }
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={edit ? "Editar produto" : "Adicionar produto"}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !podeSalvar}
            className={BTN_ACAO}
          >
            {salvando ? "Salvando..." : "Salvar produto"}
          </button>
        </>
      }
    >
      {/* Nome */}
      <div className="mb-4">
        <Campo label="Nome" required>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="ex: Camiseta bordada"
            // No celular, foco automático abre o teclado por cima do modal e o
            // botão "Salvar produto" some embaixo dele (09/10/2026). Só no mouse.
            autoFocus={focoAutomatico}
          />
        </Campo>
      </div>

      {/* Tipo */}
      <div className="mb-4">
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

      {/* Foto (URL) */}
      <div className="mb-4">
        <Campo label="Foto" hint="cole o link de uma imagem (opcional)">
          <input
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="https://..."
          />
        </Campo>
      </div>

      {/* Preço de venda */}
      <div className="mb-4">
        <Campo label="Preço de venda (R$)" required>
          <input
            type="number"
            inputMode="decimal"
            value={precoVenda}
            onChange={(e) => setPrecoVenda(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="0"
          />
        </Campo>
      </div>

      {/* Preço de custo */}
      <div className="mb-4">
        <Campo
          label={ehKit ? "Custo do kit (R$)" : "Custo de produção (R$)"}
          hint={
            !ehKit
              ? undefined
              : custoSomado != null
                ? `Nas vendas, a Pólia One usa a soma dos itens: ${fmt(custoSomado)}. Pra mudar, mude o custo de cada item.`
                : "Enquanto algum item estiver sem custo, as vendas usam este valor."
          }
        >
          <input
            type="number"
            inputMode="decimal"
            value={custoSomado != null ? String(custoSomado) : precoCusto}
            readOnly={custoSomado != null}
            onChange={(e) => setPrecoCusto(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] read-only:bg-[var(--surface)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="0"
          />
        </Campo>
      </div>

      {/* Descrição */}
      <div className="mb-4">
        <Campo label="Descrição curta">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="ex: algodão pima, tamanho único"
          />
        </Campo>
      </div>

      {/* Observação interna (ONE-120): código, fornecedor, o que ela precisar */}
      <div className="mb-4">
        <Campo
          label="Observação interna"
          hint="Só aparece pra você, aqui no cadastro. Bom pra código do produto e dados do fornecedor."
        >
          <textarea
            value={observacaoInterna}
            onChange={(e) => setObservacaoInterna(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full resize-y rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="ex: cód. CAM-014 · Malharia Sol, (11) 9999-0000, pedido mínimo 20 peças"
          />
        </Campo>
      </div>

      {tipo === "fisico" && <KitDoProduto produtoId={produtoEdit?.id ?? null} kit={kit} />}
      {tipo !== "fisico" && kit.eraKit && (
        <p className="mb-4 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
          Kit só existe em produto físico. Salvando assim, os itens do kit saem.
        </p>
      )}

      {!ehKit && (
        <EstoqueDoProduto
          estado={estoque.estado}
          onMudar={estoque.setEstado}
          carregando={estoque.carregando}
          tipo={tipo}
        />
      )}

      {/* Canal de venda */}
      <div>
        <Campo label="Onde a compra acontece">
          <input
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="ex: DM do Instagram, link de pagamento"
          />
        </Campo>
      </div>

      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}

// Ativação no GA4 (ONE-65): o primeiro produto salvo a partir da Calculadora é
// o momento em que ela viu quanto sobra. Saiu do onboarding com o passo de
// preço (ONE-50) e volta aqui. Conta depois do insert: 1 produto = o primeiro.
async function avisarAtivacaoNoGA(userId: string, comCusto: boolean) {
  const { count, error } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error || count !== 1) return;
  gtagEvent("ativacao_viu_quanto_sobra", { com_custo: comCusto });
}
