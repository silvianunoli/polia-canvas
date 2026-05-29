import { useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Pólia" },
      { name: "description", content: "Seu perfil e seu negócio, do jeito que você quer." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: ConfiguracoesPage,
});

const TIPOS = [
  { valor: "produto_fisico", label: "Produto físico", sub: "convites, cosméticos, roupas" },
  { valor: "produto_digital", label: "Produto digital", sub: "e-books, cursos, templates" },
  { valor: "servico", label: "Serviço", sub: "consultoria, assessoria, aulas" },
  { valor: "hibrido", label: "Produto e serviço", sub: "vende os dois" },
];

function ConfiguracoesPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ["configuracoes-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, business_name, business_type, streak")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const [nome, setNome] = useState("");
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState<string>("");
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [senhaOk, setSenhaOk] = useState(false);

  useEffect(() => {
    const p = profileQuery.data;
    if (p) {
      setNome(p.full_name ?? "");
      setNomeNegocio(p.business_name ?? "");
      setTipoNegocio(p.business_type ?? "");
    }
  }, [profileQuery.data]);

  const salvarPerfil = async () => {
    if (!userId) return;
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: nome,
        business_name: nomeNegocio,
        business_type: tipoNegocio || null,
      })
      .eq("id", userId);
    setSalvando(false);
    if (!error) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  };

  const alterarSenha = async () => {
    setSenhaErro(null);
    setSenhaOk(false);
    if (novaSenha.length < 8) {
      setSenhaErro("a senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaErro("as senhas não coincidem.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      setSenhaErro(error.message);
      return;
    }
    setSenhaOk(true);
    setAlterandoSenha(false);
    setNovaSenha("");
    setConfirmarSenha("");
    setTimeout(() => setSenhaOk(false), 2000);
  };

  const initial = (nome.trim()[0] || nomeNegocio.trim()[0] || "P").toUpperCase();
  const streak = profileQuery.data?.streak ?? 0;
  const email = user?.email ?? "";

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} />

      <main className="mx-auto max-w-[880px] px-12 py-12">
        <div className="mb-10">
          <h1 className="font-serif text-[#1A1A2E] text-[40px] leading-tight mb-2">
            Configurações
          </h1>
          <p className="font-handwritten text-[#C96B3E] text-[18px]">
            seu perfil e seu negócio, do jeito que você quer.
          </p>
        </div>

        {/* SEÇÃO 1 — PERFIL */}
        <Secao titulo="Seu perfil">
          <div className="space-y-5">
            <Campo label="SEU NOME">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                className="w-full h-[48px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 font-sans text-[#1A1A2E] text-[15px] focus:outline-none focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] transition-all"
              />
            </Campo>
            <Campo label="E-MAIL">
              <div className="w-full h-[48px] flex items-center bg-[rgba(26,26,46,0.04)] border border-[rgba(26,26,46,0.08)] rounded-xl px-4 font-sans text-[#1A1A2E] text-[15px] opacity-60">
                {email}
              </div>
              <p className="font-sans text-[#1A1A2E] text-[11px] opacity-40 mt-1.5">
                o e-mail não pode ser alterado
              </p>
            </Campo>
          </div>
        </Secao>

        {/* SEÇÃO 2 — NEGÓCIO */}
        <Secao titulo="Seu negócio">
          <div className="space-y-6">
            <Campo label="NOME DO NEGÓCIO">
              <input
                type="text"
                value={nomeNegocio}
                onChange={(e) => setNomeNegocio(e.target.value)}
                maxLength={80}
                className="w-full h-[48px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 font-sans text-[#1A1A2E] text-[15px] focus:outline-none focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] transition-all"
              />
            </Campo>
            <Campo label="TIPO DE NEGÓCIO">
              <div className="grid grid-cols-2 gap-3">
                {TIPOS.map((tipo) => (
                  <button
                    key={tipo.valor}
                    type="button"
                    onClick={() => setTipoNegocio(tipo.valor)}
                    className={`text-left p-4 rounded-xl border transition-colors ${
                      tipoNegocio === tipo.valor
                        ? "border-[#C96B3E] bg-[rgba(201,107,62,0.06)]"
                        : "border-[rgba(26,26,46,0.08)] hover:border-[rgba(26,26,46,0.15)]"
                    }`}
                  >
                    <p className="font-sans text-[#1A1A2E] text-[14px] font-medium mb-1">
                      {tipo.label}
                    </p>
                    <p className="font-sans text-[#1A1A2E] text-[12px] opacity-50">
                      {tipo.sub}
                    </p>
                  </button>
                ))}
              </div>
            </Campo>
          </div>
        </Secao>

        {/* SEÇÃO 3 — INTEGRAÇÕES */}
        <Secao titulo="Integrações" subtitulo="conecte ferramentas que você já usa pra ver tudo em um lugar.">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-[rgba(26,26,46,0.08)] rounded-xl">
              <div>
                <p className="font-sans text-[#1A1A2E] text-[14px] font-medium mb-0.5">
                  Google Calendar
                </p>
                <p className="font-sans text-[#1A1A2E] text-[12px] opacity-50">
                  mostre seus compromissos no painel
                </p>
              </div>
              <button
                type="button"
                disabled
                className="font-sans text-[13px] text-[#1A1A2E] opacity-40 border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2"
              >
                Em breve
              </button>
            </div>
            <div className="p-4 border border-dashed border-[rgba(26,26,46,0.1)] rounded-xl text-center">
              <p className="font-sans text-[#1A1A2E] text-[13px] opacity-40">
                Mais integrações em breve.
              </p>
            </div>
          </div>
        </Secao>

        {/* SEÇÃO 4 — SEGURANÇA */}
        <Secao titulo="Segurança">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-sans text-[#1A1A2E] text-[14px] font-medium mb-0.5">
                Senha
              </p>
              <p className="font-sans text-[#1A1A2E] text-[12px] opacity-50">
                altere sua senha de acesso
              </p>
            </div>
            {!alterandoSenha && (
              <button
                type="button"
                onClick={() => setAlterandoSenha(true)}
                className="font-sans text-[13px] text-[#C96B3E] border border-[rgba(201,107,62,0.3)] rounded-xl px-4 py-2 hover:bg-[rgba(201,107,62,0.06)] transition-colors"
              >
                Alterar senha
              </button>
            )}
          </div>

          {alterandoSenha && (
            <div className="space-y-4 mt-6 pt-6 border-t border-[rgba(26,26,46,0.06)]">
              <Campo label="NOVA SENHA">
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={8}
                  className="w-full h-[48px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 font-sans text-[#1A1A2E] text-[15px] focus:outline-none focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] transition-all"
                />
              </Campo>
              <Campo label="CONFIRMAR NOVA SENHA">
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full h-[48px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 font-sans text-[#1A1A2E] text-[15px] focus:outline-none focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] transition-all"
                />
                {novaSenha && confirmarSenha && novaSenha !== confirmarSenha && (
                  <p className="font-sans text-[#C9407A] text-[12px] mt-1.5">
                    as senhas não coincidem
                  </p>
                )}
              </Campo>
              {senhaErro && (
                <p className="font-sans text-[#C9407A] text-[12px]">{senhaErro}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAlterandoSenha(false);
                    setNovaSenha("");
                    setConfirmarSenha("");
                    setSenhaErro(null);
                  }}
                  className="font-sans text-[13px] text-[#1A1A2E] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2 hover:bg-[rgba(26,26,46,0.04)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={alterarSenha}
                  disabled={
                    novaSenha.length < 8 || novaSenha !== confirmarSenha
                  }
                  className="font-sans text-[13px] font-semibold text-[#FDF8F5] bg-[#C96B3E] rounded-xl px-4 py-2 hover:bg-[#B85A2D] transition-colors disabled:opacity-40"
                >
                  Salvar nova senha
                </button>
              </div>
            </div>
          )}
          {senhaOk && (
            <p className="font-handwritten text-[#C96B3E] text-[14px] mt-3">
              senha atualizada.
            </p>
          )}
        </Secao>

        {/* SALVAR PERFIL */}
        <div className="flex items-center justify-end gap-4 mt-10">
          <span
            className={`font-handwritten text-[#C96B3E] text-[14px] transition-opacity duration-300 ${
              salvo ? "opacity-100" : "opacity-0"
            }`}
          >
            salvo.
          </span>
          <button
            type="button"
            onClick={salvarPerfil}
            disabled={salvando}
            className="font-sans text-[14px] font-semibold text-[#FDF8F5] bg-[#C96B3E] rounded-xl px-6 py-3 hover:bg-[#B85A2D] transition-colors disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Secao({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 bg-white rounded-2xl p-6 border border-[rgba(26,26,46,0.06)]">
      <h2 className="font-serif text-[#1A1A2E] text-[22px] leading-tight mb-1">
        {titulo}
      </h2>
      {subtitulo && (
        <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50 mb-5">
          {subtitulo}
        </p>
      )}
      <div className={subtitulo ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-50 mb-2 font-bold">
        {label}
      </p>
      {children}
    </div>
  );
}
