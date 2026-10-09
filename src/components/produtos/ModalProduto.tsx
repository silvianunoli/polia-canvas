import { useState } from "react";
import { hojeISO } from "@/lib/data.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { gtagEvent } from "@/lib/gtag";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { num, type Prefill, type Produto, type ProdutoTipo } from "./tipos";

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
  const [canal, setCanal] = useState(produtoEdit?.canal ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precoVendaNum = num(precoVenda);
  const precoCustoNum = precoCusto.trim() ? num(precoCusto) : null;
  const podeSalvar = nome.trim().length > 0 && precoVendaNum > 0;

  const salvar = async () => {
    if (!podeSalvar) return;
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
      setSalvando(false);
      if (error) {
        console.error("produto_salvar", error);
        setErro("A Pólia One não conseguiu salvar o produto. Tenta de novo.");
        return;
      }
      void registrar("edit_product", { feature: "produtos", propriedades: { tipo } });
    } else {
      const { error } = await supabase.from("produtos").insert({
        user_id: userId,
        nome: nome.trim(),
        tipo,
        foto_url: fotoUrl.trim() || null,
        preco_venda: precoVendaNum,
        preco_custo: precoCustoNum,
        descricao: descricao.trim() || null,
        canal: canal.trim() || null,
        calculadora_breakdown: prefill?.calculadora_breakdown ?? null,
      } as never);
      setSalvando(false);
      if (error) {
        console.error("produto_salvar", error);
        setErro("A Pólia One não conseguiu salvar o produto. Tenta de novo.");
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
        <Campo label="Custo de produção (R$)">
          <input
            type="number"
            inputMode="decimal"
            value={precoCusto}
            onChange={(e) => setPrecoCusto(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
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
