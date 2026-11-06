// Seção "Na loja" da janela de produto (ONE-181), só em conta com loja de marca.
// A dona escreve as opções (Cor, Tamanho) e preenche cada combinação. Quantidade
// de combinação que já existe só muda pela aba Estoque, que deixa o histórico.

import { useId, useState } from "react";
import { ImageUp, Trash2, X } from "lucide-react";
import { Campo } from "@/components/ui/Campo";
import { BTN_MIUDO } from "@/lib/botoes";
import { FOTO_TIPOS } from "@/lib/loja";
import { MAX_EIXOS } from "@/lib/lojaCombinacoes";
import { urlDaFotoVariacao, type LojaDoProduto } from "./useLojaDoProduto";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

function NovaCategoria({ loja }: { loja: LojaDoProduto }) {
  const [aberta, setAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!aberta)
    return (
      <button
        type="button"
        onClick={() => setAberta(true)}
        className={`${BTN_MIUDO} mt-2 bg-white`}
      >
        + Nova categoria
      </button>
    );

  const criar = async () => {
    setSalvando(true);
    const problema = await loja.criarCategoria(nome);
    setSalvando(false);
    setErro(problema);
    if (!problema) {
      setNome("");
      setAberta(false);
    }
  };

  return (
    <div className="mt-2">
      <Campo label="Nome da nova categoria" error={erro ?? undefined}>
        <input
          value={nome}
          maxLength={60}
          onChange={(e) => setNome(e.target.value)}
          className={INPUT}
        />
      </Campo>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={salvando}
          onClick={criar}
          className={`${BTN_MIUDO} bg-white`}
        >
          {salvando ? "Criando..." : "Criar"}
        </button>
        <button type="button" onClick={() => setAberta(false)} className={`${BTN_MIUDO} bg-white`}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FotoDaCombinacao({
  loja,
  chave,
  nome,
  fotoPath,
}: {
  loja: LojaDoProduto;
  chave: string;
  nome: string;
  fotoPath: string | null;
}) {
  const id = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);

  if (fotoPath)
    return (
      <div className="relative h-11 w-11">
        <img
          src={urlDaFotoVariacao(fotoPath)}
          alt={`Foto de ${nome}`}
          className="h-11 w-11 rounded-lg border border-[var(--line)] object-cover"
        />
        <button
          type="button"
          onClick={() => loja.mudarCombinacao(chave, { fotoPath: null })}
          aria-label={`Tirar a foto de ${nome}`}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
    );

  return (
    <div>
      <input
        type="file"
        id={id}
        accept={FOTO_TIPOS.join(",")}
        className="peer sr-only"
        disabled={subindo}
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (!arquivo) return;
          setSubindo(true);
          setErro(await loja.subirFoto(chave, arquivo));
          setSubindo(false);
        }}
      />
      <label
        htmlFor={id}
        aria-label={`Enviar foto de ${nome}`}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--secondary-text)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--secondary-text)]"
      >
        {subindo ? (
          <span className="text-[11px]">...</span>
        ) : (
          <ImageUp size={16} aria-hidden="true" />
        )}
      </label>
      {erro && (
        <p role="alert" className="mt-1 text-[12px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </div>
  );
}

export function NaLojaDoProduto({ loja, ehKit }: { loja: LojaDoProduto; ehKit: boolean }) {
  if (loja.carregando)
    return (
      <fieldset className="mb-4 rounded-xl border border-[var(--line)] p-4">
        <legend className="px-1 text-[12px] text-[var(--muted)]">Na loja</legend>
        <p className="text-[13px] text-[var(--muted)]">Carregando os dados da loja…</p>
      </fieldset>
    );

  if (loja.erroAoCarregar)
    return (
      <fieldset className="mb-4 rounded-xl border border-[var(--line)] p-4">
        <legend className="px-1 text-[12px] text-[var(--muted)]">Na loja</legend>
        <p role="alert" className="text-[13px] text-[var(--danger)]">
          A Pólia One não conseguiu carregar os dados da loja. Feche a janela e abra de novo.
        </p>
      </fieldset>
    );

  const mudarEixo = (chave: string, m: { nome?: string; valores?: string }) =>
    loja.mudarEixos(loja.eixos.map((e) => (e.chave === chave ? { ...e, ...m } : e)));

  return (
    <fieldset className="mb-4 rounded-xl border border-[var(--line)] p-4">
      <legend className="px-1 text-[12px] text-[var(--muted)]">Na loja</legend>

      <div className="mb-4">
        <Campo label="Categoria">
          <select
            value={loja.categoriaId}
            onChange={(e) => loja.setCategoriaId(e.target.value)}
            className={INPUT}
          >
            <option value="">Sem categoria</option>
            {loja.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <NovaCategoria loja={loja} />
      </div>

      {ehKit ? (
        <p className="mb-4 text-[13px] text-[var(--ink-soft)]">
          Kit vende pelos itens dele, então não tem combinações próprias.
        </p>
      ) : (
        <div className="mb-4" role="radiogroup" aria-label="Como este produto vende">
          <p className="mb-1 text-[12px] text-[var(--muted)]">Como vende</p>
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-[var(--ink)]">
              <input
                type="radio"
                name="como-vende"
                checked={!loja.controla}
                onChange={() => loja.setControla(false)}
                className="h-4 w-4 accent-[var(--secondary-text)]"
              />
              Sob encomenda
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-[var(--ink)]">
              <input
                type="radio"
                name="como-vende"
                checked={loja.controla}
                onChange={() => loja.setControla(true)}
                className="h-4 w-4 accent-[var(--secondary-text)]"
              />
              Tenho em estoque
            </label>
          </div>
          <p className="text-[12.5px] text-[var(--muted)]">
            {loja.controla
              ? "Quando o estoque acaba, a loja mostra Indisponível e não deixa comprar."
              : "A loja segue vendendo e mostra o prazo."}
          </p>
        </div>
      )}

      {(ehKit || !loja.controla) && (
        <div className="mb-4">
          <Campo label="Prazo de produção (dias úteis)" hint="Vazio usa o prazo da loja.">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="120"
              step="1"
              value={loja.prazo}
              onChange={(e) => loja.setPrazo(e.target.value)}
              className={INPUT}
            />
          </Campo>
        </div>
      )}

      {!ehKit && (
        <>
          <p className="mb-1 text-[13px] font-medium text-[var(--ink)]">Opções do produto</p>
          {loja.eixos.length === 0 && (
            <p className="mb-2 text-[12.5px] text-[var(--muted)]">
              Sem opções, o produto vende de um jeito só.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {loja.eixos.map((e, i) => (
              <li
                key={e.chave}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_44px] items-end gap-2"
              >
                <Campo label={`Opção ${i + 1}`}>
                  <input
                    value={e.nome}
                    maxLength={40}
                    onChange={(ev) => mudarEixo(e.chave, { nome: ev.target.value })}
                    className={INPUT}
                    placeholder="ex: Cor"
                  />
                </Campo>
                <Campo label="Valores, separados por vírgula">
                  <input
                    value={e.valores}
                    onChange={(ev) => mudarEixo(e.chave, { valores: ev.target.value })}
                    className={INPUT}
                    placeholder="ex: Azul, Verde"
                  />
                </Campo>
                <button
                  type="button"
                  onClick={() => loja.mudarEixos(loja.eixos.filter((x) => x.chave !== e.chave))}
                  aria-label={`Tirar a opção ${i + 1}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {loja.eixos.length < MAX_EIXOS && (
            <button type="button" onClick={loja.novaOpcao} className={`${BTN_MIUDO} mt-2 bg-white`}>
              + Opção
            </button>
          )}

          {loja.combinacoes.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-[13px] font-medium text-[var(--ink)]">Combinações</p>
              <p className="mb-2 text-[12.5px] text-[var(--muted)]">
                Preço vazio segue o preço de venda do produto.
              </p>
              <ul className="flex flex-col gap-2">
                {loja.combinacoes.map((c) => (
                  <li
                    key={c.chave}
                    className="grid grid-cols-[44px_minmax(0,1fr)] items-end gap-2 rounded-lg bg-[var(--surface)] p-3 sm:grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                  >
                    <FotoDaCombinacao
                      loja={loja}
                      chave={c.chave}
                      nome={c.nome}
                      fotoPath={c.fotoPath}
                    />
                    <p className="self-center text-[14px] text-[var(--ink)]">{c.nome}</p>
                    <Campo label="Preço (R$)">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={c.preco}
                        onChange={(e) => loja.mudarCombinacao(c.chave, { preco: e.target.value })}
                        className={INPUT}
                      />
                    </Campo>
                    {loja.controla &&
                      (c.id ? (
                        <p className="pb-2 text-[13px] text-[var(--ink-soft)]">
                          {c.saldo ?? 0} no estoque
                        </p>
                      ) : (
                        <Campo label="Quantidade agora">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            value={c.inicial}
                            onChange={(e) =>
                              loja.mudarCombinacao(c.chave, { inicial: e.target.value })
                            }
                            className={INPUT}
                            placeholder="0"
                          />
                        </Campo>
                      ))}
                  </li>
                ))}
              </ul>
              {loja.controla && (
                <p className="mt-2 text-[12.5px] text-[var(--muted)]">
                  Pra mudar a quantidade de uma combinação salva, use a aba Estoque.
                </p>
              )}
            </div>
          )}

          {loja.saemComEstoque.length > 0 && (
            <p role="alert" className="mt-2 text-[12.5px] text-[var(--danger)]">
              Ao salvar, saem do estoque: {loja.saemComEstoque.join(", ")}. Renomear um valor cria
              outra combinação, sem o saldo da antiga.
            </p>
          )}

          {loja.controla &&
            loja.combinacoes.length === 0 &&
            (loja.saldoPadrao != null ? (
              <p className="mt-4 text-[13px] text-[var(--ink-soft)]">
                {loja.saldoPadrao} no estoque. Pra mudar a quantidade, use a aba Estoque.
              </p>
            ) : (
              <div className="mt-4">
                <Campo label="Quantidade agora">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={loja.inicialPadrao}
                    onChange={(e) => loja.setInicialPadrao(e.target.value)}
                    className={INPUT}
                    placeholder="0"
                  />
                </Campo>
              </div>
            ))}
        </>
      )}
    </fieldset>
  );
}
