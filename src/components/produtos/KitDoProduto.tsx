import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { Campo } from "@/components/ui/Campo";
import { BTN_MIUDO } from "@/lib/botoes";
import type { ComponenteKit } from "@/lib/kits";
import { variacoesNomeadas, type useKitDoProduto } from "./useKitDoProduto";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

const LINHA_VAZIA: ComponenteKit = { componenteId: "", skuId: null, quantidade: 1 };

/**
 * Seção "É um kit ou combo" do cadastro de produto (ONE-132). O custo do kit
 * mora no campo de custo do modal (ele vira a soma dos itens quando todos têm
 * custo); aqui ficam os itens, quantos kits dá pra montar e o que falta.
 */
export function KitDoProduto({
  produtoId,
  kit,
}: {
  produtoId: string | null;
  kit: ReturnType<typeof useKitDoProduto>;
}) {
  const { estado, setEstado, produtos, porId, preenchidos } = kit;
  const botaoAdicionar = useRef<HTMLButtonElement>(null);
  // Pode ser item de kit: produto físico ou digital, que não seja o próprio
  // nem outro kit (kit dentro de kit não pode).
  const opcoes = produtos.filter(
    (p) => p.id !== produtoId && p.componentes.length === 0 && p.tipo !== "servico",
  );
  // Estoque que o produto tinha antes de virar kit: some da contagem.
  const proprio = produtoId ? porId.get(produtoId) : undefined;
  const saldoProprio =
    proprio?.controlaEstoque && !kit.eraKit
      ? proprio.skus.reduce((t, s) => t + Math.max(0, s.saldo), 0)
      : 0;

  const mudar = (idx: number, m: Partial<ComponenteKit>) =>
    setEstado((e) => ({
      ...e,
      componentes: e.componentes.map((c, i) =>
        i === idx ? { ...c, ...m, ...(m.componenteId !== undefined ? { skuId: null } : {}) } : c,
      ),
    }));

  const tirar = (idx: number) => {
    setEstado((s) => ({ ...s, componentes: s.componentes.filter((_, i) => i !== idx) }));
    // A linha (e o botão dela) somem: o foco não pode cair no nada.
    botaoAdicionar.current?.focus();
  };

  const travado = !kit.carregou || (!!kit.bloqueio && !estado.ehKit);
  const comEstoqueLigado = preenchidos.some((c) => porId.get(c.componenteId)?.controlaEstoque);

  return (
    <div className="mb-4 rounded-xl border border-[var(--line)] p-4">
      <label
        className={`flex min-h-11 items-center gap-3 text-[14px] text-[var(--ink)] ${
          travado ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          checked={estado.ehKit}
          disabled={travado}
          aria-describedby={kit.bloqueio && !estado.ehKit ? "kit-bloqueio" : "kit-explica"}
          onChange={(e) =>
            setEstado((s) => ({
              ehKit: e.target.checked,
              componentes:
                e.target.checked && s.componentes.length === 0 ? [LINHA_VAZIA] : s.componentes,
            }))
          }
          className="h-4 w-4 accent-[var(--secondary-text)]"
        />
        É um kit ou combo
      </label>
      <p id="kit-explica" className="ml-7 text-[13px] text-[var(--muted)]">
        Vender o kit baixa o estoque de cada item. O kit não tem estoque próprio.
      </p>

      {kit.erroLeitura && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          A Pólia One não conseguiu ler os seus produtos agora.{" "}
          <button
            type="button"
            onClick={kit.tentarDeNovo}
            className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Tentar de novo
          </button>
        </p>
      )}
      {!kit.carregou && !kit.erroLeitura && (
        <p className="ml-7 mt-1 text-[13px] text-[var(--muted)]">Carregando seus produtos…</p>
      )}
      {kit.bloqueio && !estado.ehKit && (
        <p id="kit-bloqueio" className="ml-7 mt-1 text-[13px] text-[var(--ink-soft)]">
          {kit.bloqueio}
        </p>
      )}

      {estado.ehKit && kit.carregou && (
        <>
          {saldoProprio > 0 && (
            <p className="mt-3 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
              Este produto tem {saldoProprio} no estoque. Virando kit, esse número para de contar: o
              que vale é o estoque de cada item.
            </p>
          )}

          {opcoes.length === 0 ? (
            <p className="mt-3 text-[13px] text-[var(--ink-soft)]">
              O kit é montado com outros produtos do catálogo. Cadastre os itens primeiro.
            </p>
          ) : (
            <>
              <ul className="mt-3 flex flex-col">
                {estado.componentes.map((c, idx) => {
                  const p = porId.get(c.componenteId);
                  const variacoes = variacoesNomeadas(p);
                  const faltaVariacao = !c.skuId && kit.precisaVariacao(c.componenteId);
                  return (
                    <li
                      key={idx}
                      className="flex flex-col gap-2 border-t border-[var(--line)] py-3 first:border-t-0 first:pt-0"
                    >
                      <Campo label={`Item ${idx + 1}`}>
                        <select
                          value={c.componenteId}
                          onChange={(e) => mudar(idx, { componenteId: e.target.value })}
                          className={INPUT}
                        >
                          <option value="">Escolher produto</option>
                          {opcoes.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nome}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <div className="grid grid-cols-[minmax(0,1fr)_72px_44px] items-end gap-2">
                        {variacoes.length > 0 ? (
                          <Campo
                            label="Variação"
                            error={faltaVariacao ? "Escolha a variação." : undefined}
                          >
                            <select
                              value={c.skuId ?? ""}
                              onChange={(e) => mudar(idx, { skuId: e.target.value || null })}
                              className={INPUT}
                            >
                              <option value="">Escolher</option>
                              {variacoes.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.variacao}
                                </option>
                              ))}
                            </select>
                          </Campo>
                        ) : (
                          <span />
                        )}
                        <Campo label="Qtd.">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="1000"
                            step="1"
                            // Apagar o número deixa o campo vazio, não um 0 teimoso.
                            value={c.quantidade || ""}
                            onChange={(e) => mudar(idx, { quantidade: Number(e.target.value) })}
                            className={INPUT}
                          />
                        </Campo>
                        <button
                          type="button"
                          onClick={() => tirar(idx)}
                          aria-label={`Tirar o item ${idx + 1} do kit`}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                ref={botaoAdicionar}
                type="button"
                onClick={() =>
                  setEstado((s) => ({ ...s, componentes: [...s.componentes, LINHA_VAZIA] }))
                }
                className={`${BTN_MIUDO} mt-3 bg-white`}
              >
                + Adicionar item
              </button>

              <div className="mt-3 space-y-1 text-[13px]" aria-live="polite">
                {kit.vazio ? (
                  <p className="text-[var(--muted)]">{kit.erro}</p>
                ) : kit.erro ? (
                  <p className="text-[var(--danger)]">{kit.erro}</p>
                ) : (
                  <>
                    {kit.montaveis != null ? (
                      <p className="text-[var(--ink-soft)]">
                        {kit.montaveis === 0
                          ? "Com o estoque de hoje, os itens não dão pra montar nenhum kit."
                          : `Com o estoque de hoje dá pra montar ${kit.montaveis} ${
                              kit.montaveis === 1 ? "kit" : "kits"
                            }.`}
                      </p>
                    ) : (
                      !comEstoqueLigado && (
                        <p className="text-[var(--muted)]">
                          Nenhum item deste kit tem estoque ligado, então a venda não baixa nada.
                        </p>
                      )
                    )}
                    {kit.semCusto.length > 0 && (
                      <p className="text-[var(--ink-soft)]">
                        Sem custo cadastrado: {kit.semCusto.join(", ")}. Enquanto faltar, as vendas
                        usam o custo do kit digitado acima.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
