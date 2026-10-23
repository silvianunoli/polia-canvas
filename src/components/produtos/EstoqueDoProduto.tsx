// Seção "Estoque" do modal de produto (VND-03): liga o controle, cadastra as
// variações (cor, tamanho) e a quantidade inicial. Quantidade de variação que
// já existe só muda pela aba Estoque, que deixa o movimento no histórico.

import { Trash2 } from "lucide-react";
import { Campo } from "@/components/ui/Campo";
import { BTN_MIUDO } from "@/lib/botoes";
import { vazia, type EstadoEstoque, type VariacaoEditavel } from "./useEstoqueDoProduto";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

export function EstoqueDoProduto({
  estado,
  onMudar,
  carregando,
  tipo,
}: {
  estado: EstadoEstoque;
  onMudar: (e: EstadoEstoque) => void;
  carregando: boolean;
  tipo: string;
}) {
  const mudarVariacao = (chave: string, m: Partial<VariacaoEditavel>) =>
    onMudar({
      ...estado,
      variacoes: estado.variacoes.map((v) => (v.chave === chave ? { ...v, ...m } : v)),
    });

  return (
    <fieldset className="mb-4 rounded-xl border border-[var(--line)] p-4">
      <legend className="px-1 text-[12px] text-[var(--muted)]">Estoque</legend>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]">
        <input
          type="checkbox"
          checked={estado.controla}
          onChange={(e) => onMudar({ ...estado, controla: e.target.checked })}
          className="h-4 w-4 accent-[var(--secondary-text)]"
        />
        Controlar estoque deste produto
      </label>
      {!estado.controla && tipo !== "fisico" && (
        <p className="text-[12px] text-[var(--muted)]">
          Serviço e produto digital normalmente não precisam.
        </p>
      )}

      {estado.controla && carregando && (
        <p className="mt-2 text-[13px] text-[var(--muted)]">Carregando o estoque…</p>
      )}

      {estado.controla && !carregando && (
        <div className="mt-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]">
            <input
              type="checkbox"
              checked={estado.temVariacoes}
              onChange={(e) => onMudar({ ...estado, temVariacoes: e.target.checked })}
              className="h-4 w-4 accent-[var(--secondary-text)]"
            />
            Tem variação (cor, tamanho, sabor)
          </label>

          {!estado.temVariacoes && estado.variacoes.some((v) => v.id) && (
            <p className="text-[12px] text-[var(--danger)]">
              Ao salvar, as variações cadastradas saem do estoque.
            </p>
          )}
          {!estado.temVariacoes ? (
            <div className="mt-2 grid grid-cols-2 gap-3">
              {estado.padrao.id ? (
                <p className="col-span-2 text-[13px] text-[var(--ink-soft)]">
                  {estado.padrao.saldo ?? 0} no estoque. Pra mudar a quantidade, use a aba Estoque.
                </p>
              ) : (
                <Campo label="Quantidade agora">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={estado.padrao.inicial}
                    onChange={(e) =>
                      onMudar({ ...estado, padrao: { ...estado.padrao, inicial: e.target.value } })
                    }
                    className={INPUT}
                    placeholder="0"
                  />
                </Campo>
              )}
              <Campo label="Estoque mínimo" hint="abaixo disso, aparece como estoque baixo">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={estado.padrao.minimo}
                  onChange={(e) =>
                    onMudar({ ...estado, padrao: { ...estado.padrao, minimo: e.target.value } })
                  }
                  className={INPUT}
                  placeholder="0"
                />
              </Campo>
              <Campo label="Código (SKU)" hint="opcional">
                <input
                  value={estado.padrao.sku}
                  maxLength={60}
                  onChange={(e) =>
                    onMudar({ ...estado, padrao: { ...estado.padrao, sku: e.target.value } })
                  }
                  className={INPUT}
                  placeholder="ex: CAN-LUA"
                />
              </Campo>
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {estado.variacoes.map((v, idx) => (
                <li
                  key={v.chave}
                  className="grid grid-cols-2 gap-2 rounded-lg bg-[var(--surface)] p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_72px_72px_44px] sm:items-end"
                >
                  <Campo label={`Variação ${idx + 1}`}>
                    <input
                      value={v.variacao}
                      maxLength={80}
                      onChange={(e) => mudarVariacao(v.chave, { variacao: e.target.value })}
                      className={INPUT}
                      placeholder="ex: azul"
                    />
                  </Campo>
                  <Campo label="Código">
                    <input
                      value={v.sku}
                      maxLength={60}
                      onChange={(e) => mudarVariacao(v.chave, { sku: e.target.value })}
                      className={INPUT}
                      placeholder="opcional"
                    />
                  </Campo>
                  {v.id ? (
                    <p className="pb-2 text-[13px] text-[var(--ink-soft)]">
                      {v.saldo ?? 0} no estoque
                    </p>
                  ) : (
                    <Campo label="Quantidade agora">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        value={v.inicial}
                        onChange={(e) => mudarVariacao(v.chave, { inicial: e.target.value })}
                        className={INPUT}
                        placeholder="0"
                      />
                    </Campo>
                  )}
                  <Campo label="Mínimo">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={v.minimo}
                      onChange={(e) => mudarVariacao(v.chave, { minimo: e.target.value })}
                      className={INPUT}
                      placeholder="0"
                    />
                  </Campo>
                  <button
                    type="button"
                    disabled={estado.variacoes.length === 1}
                    onClick={() =>
                      onMudar({
                        ...estado,
                        variacoes: estado.variacoes.filter((x) => x.chave !== v.chave),
                      })
                    }
                    aria-label={`Remover variação ${idx + 1}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => onMudar({ ...estado, variacoes: [...estado.variacoes, vazia()] })}
                  className={`${BTN_MIUDO} bg-white`}
                >
                  + Variação
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}
