import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Campo } from "@/components/ui/Campo";
import { BTN_MIUDO } from "@/lib/botoes";
import {
  chaveCategorias,
  criarCategoria,
  useCategoriasDaVitrine,
} from "@/components/catalogo/dados";

// Categoria da Vitrine online no cadastro do produto (ONE-239, 24/11/2026).
// Antes ela só se escolhia na tela da Vitrine, produto por produto; a lista de
// produtos saiu de lá e a categoria veio pra cá. Quem tem a Loja da marca já
// escolhe a categoria no bloco "Na loja" (mesma coluna), então este campo é
// só pra quem tem a Vitrine sem a loja. O valor vai junto do "Salvar" do produto.

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

export function CategoriaDaVitrine({
  userId,
  valor,
  onMudar,
}: {
  userId: string;
  valor: string;
  onMudar: (id: string) => void;
}) {
  const qc = useQueryClient();
  const todas = useCategoriasDaVitrine(userId);
  const opcoes = (todas.data ?? []).filter((c) => c.tipo !== "colecao");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    setSalvando(true);
    setErro(null);
    const r = await criarCategoria(userId, nome);
    setSalvando(false);
    if (r.error || !r.id) return setErro(r.error);
    await qc.invalidateQueries({ queryKey: chaveCategorias(userId) });
    onMudar(r.id);
    setNome("");
    setCriando(false);
  };

  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <Campo
        label="Categoria na vitrine"
        hint="A cliente filtra a vitrine por ela."
        error={todas.isError ? "A Pólia One não conseguiu ler as categorias." : undefined}
      >
        <select
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          disabled={todas.isLoading}
          className={INPUT}
        >
          <option value="">Sem categoria</option>
          {opcoes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>
      {criando ? (
        <div className="mt-2">
          <Campo label="Nome da nova categoria" error={erro ?? undefined}>
            <input
              value={nome}
              maxLength={60}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void criar();
                }
              }}
              placeholder="ex: Canecas"
              className={INPUT}
              autoFocus
            />
          </Campo>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void criar()}
              disabled={salvando || !nome.trim()}
              className={`${BTN_MIUDO} bg-white`}
            >
              {salvando ? "Criando..." : "Criar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCriando(false);
                setNome("");
                setErro(null);
              }}
              className="min-h-11 px-2 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className={`${BTN_MIUDO} mt-2 bg-white`}
        >
          + Nova categoria
        </button>
      )}
    </div>
  );
}
