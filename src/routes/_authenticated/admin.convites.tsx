import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { toastErro, toastSucesso } from "@/lib/toast";
import {
  listarConvites,
  criarConvite,
  removerConvite,
  type ConviteListItem,
} from "@/lib/convites.functions";

export const Route = createFileRoute("/_authenticated/admin/convites")({
  head: () => ({
    meta: [{ title: "Convites · Pólia" }],
  }),
  component: AdminConvites,
});

function AdminConvites() {
  const [convites, setConvites] = useState<ConviteListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoEmail, setNovoEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { convites } = await listarConvites();
      setConvites(convites);
    } catch {
      toastErro("Não consegui carregar os convites.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  async function handleAdicionar(e: FormEvent) {
    e.preventDefault();
    const email = novoEmail.trim();
    if (!email) return;
    setEnviando(true);
    try {
      await criarConvite({ data: { email } });
      setNovoEmail("");
      toastSucesso("Convite criado.");
      carregar();
    } catch (err) {
      toastErro(err instanceof Error ? err.message : "Não consegui criar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover(email: string) {
    setRemovendo(email);
    try {
      await removerConvite({ data: { email } });
      toastSucesso("Convite removido.");
      setConvites((c) => c.filter((item) => item.email !== email));
    } catch {
      toastErro("Não consegui remover o convite.");
    } finally {
      setRemovendo(null);
    }
  }

  const pendentes = convites.filter((c) => !c.usado_em).length;

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-2">Convites</h1>
      <p className="font-sans text-[14px] text-[#1A1A2E] opacity-50 mb-6">
        {convites.length} e-mails liberados · {pendentes} ainda não usaram o convite
      </p>

      <form onSubmit={handleAdicionar} className="flex gap-3 mb-6">
        <input
          type="email"
          placeholder="email@dominio.com"
          value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)}
          disabled={enviando}
          className="font-sans text-[14px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2 bg-white flex-1 min-w-[220px]"
        />
        <button
          type="submit"
          disabled={enviando || !novoEmail.trim()}
          className="font-sans text-[14px] font-medium text-white bg-[#C96B3E] rounded-xl px-5 py-2 disabled:opacity-50"
        >
          {enviando ? "Adicionando..." : "Liberar e-mail"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-[rgba(26,26,46,0.06)] overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-[rgba(26,26,46,0.06)]">
              {["E-mail", "Status", "Criado em", "Usado em", ""].map((h) => (
                <th
                  key={h}
                  className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 px-5 py-3 text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {convites.map((c) => (
              <tr
                key={c.email}
                className="border-b border-[rgba(26,26,46,0.04)] hover:bg-[rgba(26,26,46,0.02)]"
              >
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[14px]">{c.email}</td>
                <td className="px-5 py-3">
                  <span
                    className="font-sans text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={
                      c.usado_em
                        ? { background: "rgba(45,106,79,0.1)", color: "#2D6A4F" }
                        : { background: "rgba(184,134,46,0.12)", color: "#B8862E" }
                    }
                  >
                    {c.usado_em ? "Usado" : "Pendente"}
                  </span>
                </td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-50">
                  {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-50">
                  {c.usado_em ? new Date(c.usado_em).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemover(c.email)}
                    disabled={removendo === c.email}
                    aria-label={`Remover convite de ${c.email}`}
                    className="text-[#1A1A2E] opacity-40 hover:opacity-100 hover:text-[#C0392B] disabled:opacity-20"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!carregando && convites.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center font-sans text-[#1A1A2E] text-[13px] opacity-40"
                >
                  Nenhum convite ainda.
                </td>
              </tr>
            )}
            {carregando && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center font-sans text-[#1A1A2E] text-[13px] opacity-40"
                >
                  Carregando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
