import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

/**
 * Modal de registro de entrada/saída. Vive fora da rota /financeiro desde
 * 03/09/2026 (COPY-04) porque o Painel do plano Confere também precisa dele: o
 * card do grátis promete "quanto já entrou e quanto falta pra fechar as contas
 * do mês", e sem poder registrar um lançamento esse painel mostrava R$ 0 pra
 * sempre. A AÇÃO de registrar é de todo plano; a TELA /financeiro (histórico
 * completo, filtros, período, os três números do mês, resumo pro contador)
 * continua sendo do Controle.
 */

export type RegistrarTipo = "entrada" | "saida";

export interface Lancamento {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  descricao: string | null;
  categoria: string | null;
  created_at: string;
}

// Semente padrão pra usuárias novas; some assim que o histórico real tiver categorias.
const CATEGORIAS_ENTRADA = ["Venda de produto", "Prestação de serviço", "Outros"];
const CATEGORIAS_SAIDA = [
  "Insumos / estoque",
  "Marketing",
  "Ferramentas e assinaturas",
  "Pró-labore",
  "Outros",
];
const NOVA_CATEGORIA = "+ nova categoria";

export function ModalLancamento({
  userId,
  tipoInicial,
  dataPadrao,
  prefill,
  lancamentoEdit,
  historico,
  onClose,
  onSaved,
}: {
  userId: string;
  tipoInicial: RegistrarTipo;
  dataPadrao: string;
  prefill: { valor?: number; desc?: string; categoria?: string } | null;
  lancamentoEdit: Lancamento | null;
  historico: Lancamento[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!lancamentoEdit;
  const [tipo, setTipo] = useState<RegistrarTipo>(
    (lancamentoEdit?.tipo as RegistrarTipo) ?? tipoInicial,
  );
  // Campo de valor: dígitos acumulam da direita pra esquerda, em centavos.
  const [cents, setCents] = useState(() => {
    const v = lancamentoEdit?.valor ?? prefill?.valor;
    return v ? Math.round(v * 100) : 0;
  });
  const [data, setData] = useState(lancamentoEdit?.data ?? dataPadrao);
  const [descricao, setDescricao] = useState(lancamentoEdit?.descricao ?? prefill?.desc ?? "");
  const [categoria, setCategoria] = useState(lancamentoEdit?.categoria ?? prefill?.categoria ?? "");
  const [novaCategoriaAberta, setNovaCategoriaAberta] = useState(false);
  const [novaCategoriaTexto, setNovaCategoriaTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorNum = cents / 100;

  // Categorias derivadas do histórico real da usuária, unidas com semente padrão pra quem é nova.
  const categorias = useMemo(() => {
    const semente = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
    const doHistorico = [
      ...new Set(
        historico
          .filter((l) => l.tipo === tipo && l.categoria && l.categoria.trim())
          .map((l) => l.categoria!.trim()),
      ),
    ];
    const unidas = [...doHistorico];
    for (const s of semente) if (!unidas.includes(s)) unidas.push(s);
    return unidas;
  }, [historico, tipo]);

  const trocarTipo = (t: RegistrarTipo) => {
    setTipo(t);
    setCategoria(""); // categorias dependem do tipo; limpa ao trocar
    setNovaCategoriaAberta(false);
    setNovaCategoriaTexto("");
  };

  const escolherCategoria = (c: string) => {
    if (c === NOVA_CATEGORIA) {
      setNovaCategoriaAberta(true);
      return;
    }
    setCategoria(categoria === c ? "" : c);
  };

  const moedaFmt = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const onValorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setCents((c) => c * 10 + Number(e.key));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setCents((c) => Math.floor(c / 10));
    } else if (!["Tab", "Escape"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const categoriaFinal = novaCategoriaAberta ? novaCategoriaTexto.trim() : categoria;

  // Descrição e categoria são opcionais: dá pra registrar só o valor em 2 toques.
  const faltaMsg = !cents ? "Falta o valor" : "";

  const salvar = async () => {
    if (faltaMsg) return;
    setSalvando(true);
    setErro(null);
    const payload = {
      tipo,
      valor: valorNum,
      data,
      descricao: descricao.trim() || null,
      categoria: categoriaFinal || null,
    };
    const { error } =
      edit && lancamentoEdit
        ? await supabase.from("lancamentos").update(payload).eq("id", lancamentoEdit.id)
        : await supabase.from("lancamentos").insert({ user_id: userId, ...payload });
    setSalvando(false);
    if (error) {
      // O erro do banco vem em inglês técnico: fica no log, não na tela.
      console.error("lancamento_salvar", error);
      setErro("Não conseguimos salvar o lançamento agora. Tenta de novo.");
      return;
    }
    track(edit ? "lancamento_editado" : "lancamento_criado", { tipo });
    onSaved();
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-[24px] text-[var(--ink)]">
          {edit ? "Editar lançamento" : "Novo lançamento"}
        </h2>

        {/* Tipo */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Tipo</label>
          <div className="flex gap-2">
            {(
              [
                { id: "entrada", label: "Entrada" },
                { id: "saida", label: "Saída" },
              ] as { id: RegistrarTipo; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => trocarTipo(t.id)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[14px] ${
                  tipo === t.id
                    ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                    : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Valor */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Valor (R$)</label>
          <input
            type="text"
            inputMode="numeric"
            value={cents ? moedaFmt : ""}
            onKeyDown={onValorKeyDown}
            onChange={() => {}}
            placeholder="R$ 0,00"
            autoFocus
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-right text-[22px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
          />
        </div>

        {/* Data */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:outline-none"
          />
        </div>

        {/* Descrição */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Descrição</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="ex: pagamento da Ana"
          />
        </div>

        {/* Categoria */}
        <div className="mb-6">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => escolherCategoria(c)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-150 ${
                  categoria === c
                    ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-ink)]"
                    : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => escolherCategoria(NOVA_CATEGORIA)}
              className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-150 ${
                novaCategoriaAberta
                  ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
              }`}
            >
              {NOVA_CATEGORIA}
            </button>
          </div>
          {novaCategoriaAberta && (
            <input
              autoFocus
              value={novaCategoriaTexto}
              onChange={(e) => setNovaCategoriaTexto(e.target.value)}
              placeholder="Nome da categoria"
              maxLength={40}
              className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            />
          )}
        </div>

        {erro && <p className="mb-3 text-[13px] text-[var(--danger)]">{erro}</p>}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[var(--muted)]">{faltaMsg}</span>
          <span className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando || !!faltaMsg}
              className="rounded-xl bg-[var(--secondary)] px-5 py-2 text-[14px] font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : edit ? "Salvar alterações" : "Salvar lançamento"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
