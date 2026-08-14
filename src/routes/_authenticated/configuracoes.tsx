import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toastErro, toastSucesso } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Switch } from "@/components/ui/switch";
import { dadosEmissorRecibo } from "@/lib/recibo.functions";
import { gerarReciboPdf } from "@/lib/gerarReciboPdf";
import { track } from "@/lib/analytics";
import { statusAssinatura, cancelarAssinatura } from "@/lib/stripe.functions";
import { excluirMinhaConta } from "@/lib/conta.functions";
import {
  statusConexaoGoogle,
  iniciarConexaoGoogle,
  desconectarGoogle,
} from "@/lib/calendarGoogle.functions";

const NOME_PLANO: Record<string, string> = {
  beta: "Plano de lançamento",
  confere: "Confere",
  controle: "Controle",
  projete: "Projete",
  cancelada: "Assinatura cancelada",
};

function formatarData(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · Pólia" },
      { name: "description", content: "Perfil e negócio, do jeito que fizer sentido." },
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

function ConfiguracoesPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;

  const profileQuery = useQuery({
    queryKey: ["configuracoes-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "full_name, business_name, business_type, razao_social, cnpj, streak, notif_resumo_semanal, notif_novidades, notif_dicas, plano",
        )
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const [nome, setNome] = useState("");
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [nomeSalvo, setNomeSalvo] = useState(false);
  const [nomeNegocioSalvo, setNomeNegocioSalvo] = useState(false);
  const businessNameAtual = profileQuery.data?.business_name ?? "";

  // Razão social + CNPJ: só usados no cabeçalho do Resumo pro contador
  // (Projete), mas coletados aqui sem gate de plano — dado útil de já ter
  // preenchido se ela upgradar depois.
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [razaoSocialSalvo, setRazaoSocialSalvo] = useState(false);
  const [cnpjSalvo, setCnpjSalvo] = useState(false);

  const [notifResumo, setNotifResumo] = useState(true);
  const [notifNovidades, setNotifNovidades] = useState(true);
  const [notifDicas, setNotifDicas] = useState(true);
  const plano = profileQuery.data?.plano ?? "beta";
  const [baixandoRecibo, setBaixandoRecibo] = useState(false);
  const queryClient = useQueryClient();

  const assinaturaQuery = useQuery({
    queryKey: ["assinatura-status", userId],
    enabled: !!userId,
    queryFn: () => statusAssinatura(),
  });
  const assinatura = assinaturaQuery.data;

  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const invalidarAssinatura = () => {
    queryClient.invalidateQueries({ queryKey: ["assinatura-status", userId] });
    queryClient.invalidateQueries({ queryKey: ["configuracoes-profile", userId] });
  };

  // ── Google Calendar: status real da conexão (era um "EM BREVE" fixo, mesmo já integrado) ──
  const statusGoogleQuery = useQuery({
    queryKey: ["google-status", userId],
    enabled: !!userId,
    queryFn: () => statusConexaoGoogle(),
  });
  const googleConectado = statusGoogleQuery.data?.conectado ?? false;
  const googleEmail = statusGoogleQuery.data?.email ?? null;

  const conectarGoogleMutation = useMutation({
    mutationFn: () => iniciarConexaoGoogle(),
    onSuccess: (res) => {
      if (res.error || !res.url) {
        toastErro(res.error ?? "Não consegui conectar com o Google agora.");
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro("Não consegui iniciar a conexão com o Google."),
  });

  const desconectarGoogleMutation = useMutation({
    mutationFn: () => desconectarGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-status", userId] });
      toastSucesso("Google Calendar desconectado.");
    },
    onError: () => toastErro("Não consegui desconectar agora."),
  });

  const cancelar = async () => {
    setCancelando(true);
    try {
      const resultado = await cancelarAssinatura();
      if (!resultado.ok) {
        toastErro(resultado.error ?? "Não consegui cancelar sua assinatura agora. Tenta de novo.");
        return;
      }
      track("assinatura_cancelada");
      toastSucesso("Assinatura cancelada. Fica ativa até o fim do período já pago.");
      setConfirmandoCancelamento(false);
      invalidarAssinatura();
    } catch {
      toastErro("Não consegui cancelar sua assinatura agora. Tenta de novo.");
    } finally {
      setCancelando(false);
    }
  };

  const baixarRecibo = async () => {
    setBaixandoRecibo(true);
    try {
      const emissor = await dadosEmissorRecibo();
      if (!emissor.nome || !emissor.cpf) {
        toastErro("O recibo ainda não está configurado. Fala com o suporte.");
        return;
      }
      const preco = assinatura?.preco;
      if (!preco) {
        toastErro("Não consegui identificar o valor da sua assinatura. Fala com o suporte.");
        return;
      }
      const anual = preco.intervalo === "year";
      gerarReciboPdf({
        emissorNome: emissor.nome,
        emissorCpf: emissor.cpf,
        emissorEndereco: emissor.endereco,
        pagadorNome: profileQuery.data?.full_name || "Assinante Pólia",
        pagadorEmail: user?.email ?? "",
        descricao: `Assinatura Pólia, plano ${NOME_PLANO[preco.tier] ?? preco.tier} (${anual ? "anual" : "mensal"})`,
        valor: preco.valorCentavos / 100,
        dataEmissao: new Date(),
      });
      track("recibo_baixado");
    } catch {
      toastErro("Não consegui gerar o recibo agora. Tenta de novo.");
    } finally {
      setBaixandoRecibo(false);
    }
  };

  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [senhaOk, setSenhaOk] = useState(false);

  const [alterandoEmail, setAlterandoEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState("");
  const [emailErro, setEmailErro] = useState<string | null>(null);
  const [emailOk, setEmailOk] = useState(false);
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  const [excluindoConta, setExcluindoConta] = useState(false);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const carregouInicial = useRef(false);
  const nomeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nomeNegocioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const razaoSocialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cnpjTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = profileQuery.data;
    if (p) {
      setNome(p.full_name ?? "");
      setNomeNegocio(p.business_name ?? "");
      setRazaoSocial(p.razao_social ?? "");
      setCnpj(p.cnpj ?? "");
      setNotifResumo(p.notif_resumo_semanal ?? true);
      setNotifNovidades(p.notif_novidades ?? true);
      setNotifDicas(p.notif_dicas ?? true);
      carregouInicial.current = true;
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (!userId || !carregouInicial.current) return;
    if (nomeTimer.current) clearTimeout(nomeTimer.current);
    nomeTimer.current = setTimeout(async () => {
      await supabase.from("profiles").update({ full_name: nome }).eq("id", userId);
      setNomeSalvo(true);
      setTimeout(() => setNomeSalvo(false), 1600);
    }, 600);
    return () => {
      if (nomeTimer.current) clearTimeout(nomeTimer.current);
    };
  }, [nome, userId]);

  useEffect(() => {
    if (!userId || !carregouInicial.current) return;
    if (nomeNegocioTimer.current) clearTimeout(nomeNegocioTimer.current);
    nomeNegocioTimer.current = setTimeout(async () => {
      await supabase.from("profiles").update({ business_name: nomeNegocio }).eq("id", userId);
      setNomeNegocioSalvo(true);
      setTimeout(() => setNomeNegocioSalvo(false), 1600);
    }, 600);
    return () => {
      if (nomeNegocioTimer.current) clearTimeout(nomeNegocioTimer.current);
    };
  }, [nomeNegocio, userId]);

  useEffect(() => {
    if (!userId || !carregouInicial.current) return;
    if (razaoSocialTimer.current) clearTimeout(razaoSocialTimer.current);
    razaoSocialTimer.current = setTimeout(async () => {
      await supabase.from("profiles").update({ razao_social: razaoSocial }).eq("id", userId);
      setRazaoSocialSalvo(true);
      setTimeout(() => setRazaoSocialSalvo(false), 1600);
    }, 600);
    return () => {
      if (razaoSocialTimer.current) clearTimeout(razaoSocialTimer.current);
    };
  }, [razaoSocial, userId]);

  useEffect(() => {
    if (!userId || !carregouInicial.current) return;
    if (cnpjTimer.current) clearTimeout(cnpjTimer.current);
    cnpjTimer.current = setTimeout(async () => {
      await supabase.from("profiles").update({ cnpj }).eq("id", userId);
      setCnpjSalvo(true);
      setTimeout(() => setCnpjSalvo(false), 1600);
    }, 600);
    return () => {
      if (cnpjTimer.current) clearTimeout(cnpjTimer.current);
    };
  }, [cnpj, userId]);

  const toggleNotif = async (
    campo: "notif_resumo_semanal" | "notif_novidades" | "notif_dicas",
    valor: boolean,
  ) => {
    if (!userId) return;
    if (campo === "notif_resumo_semanal") setNotifResumo(valor);
    if (campo === "notif_novidades") setNotifNovidades(valor);
    if (campo === "notif_dicas") setNotifDicas(valor);
    const payload =
      campo === "notif_resumo_semanal"
        ? { notif_resumo_semanal: valor }
        : campo === "notif_novidades"
          ? { notif_novidades: valor }
          : { notif_dicas: valor };
    await supabase.from("profiles").update(payload).eq("id", userId);
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

  const alterarEmail = async () => {
    setEmailErro(null);
    setEmailOk(false);
    const parsed = z.string().trim().email().safeParse(novoEmail);
    if (!parsed.success) {
      setEmailErro("E-mail inválido. Confere o @.");
      return;
    }
    if (parsed.data !== confirmarEmail.trim()) {
      setEmailErro("Os e-mails não coincidem.");
      return;
    }
    if (parsed.data.toLowerCase() === email.toLowerCase()) {
      setEmailErro("Esse já é o e-mail atual.");
      return;
    }
    setSalvandoEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: parsed.data });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          setEmailErro("Esse e-mail já está em uso por outra conta.");
        } else {
          setEmailErro("Não consegui trocar o e-mail agora. Tenta de novo.");
        }
        return;
      }
      track("email_troca_solicitada");
      setEmailOk(true);
      setAlterandoEmail(false);
      setNovoEmail("");
      setConfirmarEmail("");
    } catch {
      setEmailErro("Falha de conexão. Confere a internet e tenta de novo.");
    } finally {
      setSalvandoEmail(false);
    }
  };

  // Quem ainda não preencheu nome do negócio confirma com uma frase fixa, pra não
  // travar a exclusão de conta pra sempre (achado de LGPD: botão desabilitado sem saída).
  const FRASE_CONFIRMACAO_PADRAO = "EXCLUIR CONTA";
  const fraseConfirmacao = businessNameAtual || FRASE_CONFIRMACAO_PADRAO;
  const confirmacaoBate = confirmacaoExclusao.trim() === fraseConfirmacao;

  const pedirExclusao = async () => {
    if (!userId || !confirmacaoBate) return;
    setExcluindo(true);
    // Apaga de verdade: cancela o Stripe, apaga todos os dados no banco e remove
    // o login. Só desloga se deu certo — senão a usuária pensaria que apagou sem ter.
    const resultado = await excluirMinhaConta();
    if (!resultado.ok) {
      toastErro(resultado.error ?? "Não consegui excluir a conta agora. Tenta de novo.");
      setExcluindo(false);
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  const initial = (nome.trim()[0] || nomeNegocio.trim()[0] || "P").toUpperCase();
  const streak = profileQuery.data?.streak ?? 0;
  const email = user?.email ?? "";

  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Conta"
      titulo="Configurações."
      subtitulo="Seu perfil, seu negócio, integrações e assinatura."
    >
      <div>
        {/* SEÇÃO 1 — PERFIL */}
        <Secao titulo="Seu perfil">
          <div className="space-y-5">
            <Campo label="SEU NOME" saved={nomeSalvo}>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                placeholder="Seu nome"
                className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
              />
            </Campo>
            <Campo label="E-MAIL">
              <div className="w-full h-[48px] flex items-center justify-between bg-[var(--surface)] border border-[var(--line)] rounded-xl px-4">
                <span className="font-sans text-[var(--ink-soft)] text-[15px]">{email}</span>
                {!alterandoEmail && (
                  <button
                    type="button"
                    onClick={() => setAlterandoEmail(true)}
                    className="font-sans text-[13px] text-[var(--secondary-text)] hover:underline"
                  >
                    Trocar e-mail
                  </button>
                )}
              </div>

              {alterandoEmail && (
                <div className="space-y-4 mt-4 pt-4 border-t border-[var(--line)]">
                  <Campo label="NOVO E-MAIL">
                    <input
                      type="email"
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                      className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
                    />
                  </Campo>
                  <Campo label="CONFIRMAR NOVO E-MAIL">
                    <input
                      type="email"
                      value={confirmarEmail}
                      onChange={(e) => setConfirmarEmail(e.target.value)}
                      className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
                    />
                    {novoEmail && confirmarEmail && novoEmail !== confirmarEmail && (
                      <p className="font-sans text-[var(--ink-soft)] text-[12px] mt-1.5">
                        os e-mails não coincidem
                      </p>
                    )}
                  </Campo>
                  {emailErro && (
                    <p className="font-sans text-[var(--danger)] text-[12px]">{emailErro}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAlterandoEmail(false);
                        setNovoEmail("");
                        setConfirmarEmail("");
                        setEmailErro(null);
                      }}
                      className="font-sans text-[13px] text-[var(--ink)] border border-[var(--line)] rounded-xl px-4 py-2 hover:bg-[var(--surface)] transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={alterarEmail}
                      disabled={salvandoEmail || !novoEmail || novoEmail !== confirmarEmail}
                      className="font-sans text-[13px] font-semibold text-[var(--secondary-ink)] bg-[var(--secondary)] rounded-xl px-4 py-2 hover:bg-[var(--secondary)] transition-colors disabled:opacity-40"
                    >
                      {salvandoEmail ? "Enviando..." : "Confirmar troca"}
                    </button>
                  </div>
                </div>
              )}
              {emailOk && (
                <p className="font-fraunces italic text-[15px] text-[var(--ink-soft)] mt-3">
                  quase lá: confira a caixa de entrada do novo e-mail e clique no link de
                  confirmação.
                </p>
              )}
              {!alterandoEmail && !emailOk && (
                <p className="font-sans text-[var(--muted)] text-[11px] mt-1.5">
                  a troca só vale depois de confirmar pelo link enviado ao novo e-mail
                </p>
              )}
            </Campo>
          </div>
        </Secao>

        {/* SEÇÃO 2 — NEGÓCIO */}
        <Secao titulo="Seu negócio">
          <Campo label="NOME DO NEGÓCIO" saved={nomeNegocioSalvo}>
            <input
              type="text"
              value={nomeNegocio}
              onChange={(e) => setNomeNegocio(e.target.value)}
              maxLength={80}
              placeholder="Ex: Ateliê da Aimer · Estúdio Florescer · Doces da Lua"
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
            />
            <p className="font-sans text-[var(--muted)] text-[11px] mt-1.5">
              aparece no topo do seu planejamento
            </p>
          </Campo>

          <Campo label="RAZÃO SOCIAL" saved={razaoSocialSalvo}>
            <input
              type="text"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              maxLength={120}
              placeholder="Ex: Aimer Confecções e Serviços LTDA"
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
            />
            <p className="font-sans text-[var(--muted)] text-[11px] mt-1.5">
              usada no cabeçalho do Resumo pro contador (Projete)
            </p>
          </Campo>

          <Campo label="CNPJ" saved={cnpjSalvo}>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              maxLength={18}
              placeholder="00.000.000/0000-00"
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
            />
          </Campo>
        </Secao>

        {/* SEÇÃO 3 — INTEGRAÇÕES */}
        <Secao
          titulo="Integrações"
          subtitulo="conecta ferramentas de uso diário pra reunir tudo num lugar só."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-[var(--line)] rounded-xl">
              <div>
                <p className="font-sans text-[var(--ink)] text-[14px] font-medium mb-0.5">
                  Google Calendar
                </p>
                <p className="font-sans text-[var(--ink-soft)] text-[12px]">
                  {googleConectado
                    ? `conectado como ${googleEmail}`
                    : "veja seus compromissos no Calendário"}
                </p>
              </div>
              {statusGoogleQuery.isLoading ? (
                <span className="text-[var(--muted)] text-[12px]">carregando...</span>
              ) : googleConectado ? (
                <button
                  type="button"
                  onClick={() => desconectarGoogleMutation.mutate()}
                  disabled={desconectarGoogleMutation.isPending}
                  className="font-sans text-[13px] text-[var(--ink-soft)] border border-[var(--line)] rounded-xl px-4 py-2 hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
                >
                  {desconectarGoogleMutation.isPending ? "Desconectando..." : "Desconectar"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => conectarGoogleMutation.mutate()}
                  disabled={conectarGoogleMutation.isPending}
                  className="font-sans text-[13px] text-[var(--secondary-text)] border border-[var(--secondary)] rounded-xl px-4 py-2 hover:bg-[var(--secondary-light)] transition-colors disabled:opacity-50"
                >
                  {conectarGoogleMutation.isPending ? "Conectando..." : "Conectar"}
                </button>
              )}
            </div>
            <div className="p-4 border border-dashed border-[var(--line)] rounded-xl text-center">
              <p className="font-sans text-[var(--muted)] text-[13px]">
                Mais integrações em breve.
              </p>
            </div>
          </div>
        </Secao>

        {/* SEÇÃO 4 — SEGURANÇA */}
        <Secao titulo="Segurança">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-sans text-[var(--ink)] text-[14px] font-medium mb-0.5">Senha</p>
              <p className="font-sans text-[var(--ink-soft)] text-[12px]">
                altere sua senha de acesso
              </p>
            </div>
            {!alterandoSenha && (
              <button
                type="button"
                onClick={() => setAlterandoSenha(true)}
                className="font-sans text-[13px] text-[var(--secondary-text)] border border-[var(--secondary)] rounded-xl px-4 py-2 hover:bg-[var(--secondary-light)] transition-colors"
              >
                Alterar senha
              </button>
            )}
          </div>

          {alterandoSenha && (
            <div className="space-y-4 mt-6 pt-6 border-t border-[var(--line)]">
              <Campo label="NOVA SENHA">
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={8}
                  className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
                />
              </Campo>
              <Campo label="CONFIRMAR NOVA SENHA">
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-all"
                />
                {novaSenha && confirmarSenha && novaSenha !== confirmarSenha && (
                  <p className="font-sans text-[var(--ink-soft)] text-[12px] mt-1.5">
                    as senhas não coincidem
                  </p>
                )}
              </Campo>
              {senhaErro && (
                <p className="font-sans text-[var(--danger)] text-[12px]">{senhaErro}</p>
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
                  className="font-sans text-[13px] text-[var(--ink)] border border-[var(--line)] rounded-xl px-4 py-2 hover:bg-[var(--surface)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={alterarSenha}
                  disabled={novaSenha.length < 8 || novaSenha !== confirmarSenha}
                  className="font-sans text-[13px] font-semibold text-[var(--secondary-ink)] bg-[var(--secondary)] rounded-xl px-4 py-2 hover:bg-[var(--secondary)] transition-colors disabled:opacity-40"
                >
                  Salvar nova senha
                </button>
              </div>
            </div>
          )}
          {senhaOk && (
            <p className="font-fraunces italic text-[15px] text-[var(--ink-soft)] mt-3">
              senha atualizada.
            </p>
          )}
        </Secao>

        {/* SEÇÃO 5 — NOTIFICAÇÕES */}
        <Secao titulo="Notificações" subtitulo="escolha o que chega por e-mail.">
          <div className="divide-y divide-[var(--line)]">
            <ToggleLinha
              titulo="Resumo semanal"
              descricao="um panorama do seu negócio toda semana"
              checked={notifResumo}
              onCheckedChange={(v) => toggleNotif("notif_resumo_semanal", v)}
            />
            <ToggleLinha
              titulo="Novidades da Pólia"
              descricao="quando algo novo chega no app"
              checked={notifNovidades}
              onCheckedChange={(v) => toggleNotif("notif_novidades", v)}
            />
            <ToggleLinha
              titulo="Dicas e conteúdos"
              descricao="ideias pra crescer seu negócio"
              checked={notifDicas}
              onCheckedChange={(v) => toggleNotif("notif_dicas", v)}
            />
          </div>
        </Secao>

        {/* SEÇÃO 6 — ASSINATURA */}
        <Secao titulo="Assinatura">
          {assinaturaQuery.isLoading && (
            <p className="font-sans text-[13px] text-[var(--muted)]">Carregando...</p>
          )}

          {!assinaturaQuery.isLoading && assinatura?.ativa && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block rounded bg-[var(--secondary)] px-2.5 py-1 font-semibold text-[10px] font-bold uppercase tracking-[1px] text-[var(--secondary-ink)]">
                    {NOME_PLANO[plano] ?? plano}
                  </span>
                  <p className="mt-2 font-sans text-[14px] text-[var(--ink)]">
                    {assinatura.cancelAtPeriodEnd
                      ? `Cancelada. Fica ativa até ${formatarData(assinatura.currentPeriodEnd)}.`
                      : `Próxima cobrança em ${formatarData(assinatura.currentPeriodEnd)}.`}
                  </p>
                </div>
                {assinatura.preco && (
                  <div className="text-right">
                    <p className="font-cabinet text-[28px] leading-none text-[var(--ink)]">
                      R${" "}
                      {(assinatura.preco.valorCentavos / 100).toLocaleString("pt-BR", {
                        minimumFractionDigits: assinatura.preco.valorCentavos % 100 ? 2 : 0,
                      })}
                    </p>
                    <p className="mt-1 font-sans text-[12px] text-[var(--muted)]">
                      {assinatura.preco.intervalo === "year" ? "por ano" : "por mês"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!assinaturaQuery.isLoading && !assinatura?.ativa && plano !== "beta" && (
            <>
              <p className="font-fraunces italic text-[15px] text-[var(--ink-soft)] mb-4">
                {plano === "cancelada"
                  ? "sua assinatura foi cancelada. assine de novo quando quiser."
                  : "no Confere agora. Passa pro Controle ou Projete pra abrir o negócio inteiro."}
              </p>
              <a
                href="/assinar"
                className="inline-block rounded-xl bg-[var(--secondary)] px-5 py-2.5 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] no-underline transition-colors hover:opacity-90"
              >
                Ver planos
              </a>
            </>
          )}

          {!assinaturaQuery.isLoading && !assinatura?.ativa && plano === "beta" && (
            <p className="font-fraunces italic text-[15px] text-[var(--ink-soft)]">
              plano de lançamento: acesso completo, sem cobrança.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {assinatura?.ativa && !assinatura.cancelAtPeriodEnd && !confirmandoCancelamento && (
              <button
                type="button"
                onClick={() => setConfirmandoCancelamento(true)}
                className="rounded-xl border border-[var(--line)] px-4 py-2 font-sans text-[13px] text-[var(--ink-soft)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Cancelar assinatura
              </button>
            )}
            {confirmandoCancelamento && (
              <div className="flex items-center gap-2">
                <span className="font-sans text-[13px] text-[var(--ink-soft)]">
                  cancelar mesmo? fica ativa até o fim do período já pago.
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmandoCancelamento(false)}
                  disabled={cancelando}
                  className="rounded-xl border border-[var(--line)] px-3 py-1.5 font-sans text-[13px] text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={cancelar}
                  disabled={cancelando}
                  className="rounded-xl border border-[var(--danger)] px-3 py-1.5 font-sans text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white disabled:opacity-50"
                >
                  {cancelando ? "Cancelando..." : "Confirmar cancelamento"}
                </button>
              </div>
            )}
            {plano !== "beta" && (
              <button
                type="button"
                onClick={baixarRecibo}
                disabled={baixandoRecibo}
                className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 font-sans text-[13px] text-[var(--ink-soft)] transition-colors hover:border-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {baixandoRecibo ? "Gerando recibo..." : "Baixar recibo"}
              </button>
            )}
          </div>
        </Secao>

        {/* SEÇÃO 7 — AJUDA */}
        <Secao titulo="Ajuda">
          <p className="font-fraunces italic text-[15px] text-[var(--ink-soft)] mb-4">
            dúvida rápida, fala com a gente em Ajuda. Coisa que precisa de acompanhamento, abre um
            chamado.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/ajuda#contato"
              className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 font-sans text-[13px] text-[var(--ink)] no-underline transition-colors hover:border-[var(--secondary)]"
            >
              Central de ajuda
            </a>
            <a
              href="/chamados"
              className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 font-sans text-[13px] text-[var(--ink)] no-underline transition-colors hover:border-[var(--secondary)]"
            >
              Seus chamados
            </a>
          </div>
        </Secao>

        {/* SEÇÃO 8 — ZONA DE PERIGO */}
        <section className="mb-8 rounded-2xl border border-[var(--danger)] bg-[var(--danger-soft)] p-6">
          <h2 className="text-[20px] leading-tight text-[var(--danger)]">Excluir conta</h2>
          <p className="mt-2 font-sans text-[14px] text-[var(--ink-soft)]">
            Excluir a conta apaga planejamento, financeiro, clientes e notas. Não tem volta.
          </p>

          {!excluindoConta && (
            <button
              type="button"
              onClick={() => setExcluindoConta(true)}
              className="mt-4 rounded-xl border border-[var(--danger)] bg-white px-4 py-2 font-sans text-[13px] font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)] hover:text-white"
            >
              Excluir conta
            </button>
          )}

          {excluindoConta && (
            <div className="mt-4">
              <p className="font-sans text-[13px] text-[var(--ink-soft)] mb-2">
                Digite {fraseConfirmacao} pra confirmar:
              </p>
              <input
                type="text"
                value={confirmacaoExclusao}
                onChange={(e) => setConfirmacaoExclusao(e.target.value)}
                placeholder={fraseConfirmacao}
                className="w-full h-[48px] border border-[var(--danger)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] outline-none focus:shadow-[0_0_0_3px_var(--danger-soft)] transition-all"
              />
              <div className="flex gap-2 justify-end mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setExcluindoConta(false);
                    setConfirmacaoExclusao("");
                  }}
                  className="font-sans text-[13px] text-[var(--ink)] border border-[var(--line)] rounded-xl px-4 py-2 hover:bg-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={pedirExclusao}
                  disabled={!confirmacaoBate || excluindo}
                  className="rounded-xl border border-[var(--danger)] bg-white px-4 py-2 font-sans text-[13px] font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[var(--danger)]"
                >
                  {excluindo ? "Excluindo..." : "Excluir de vez"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </PaginaLogada>
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
    <section className="mb-8 bg-white rounded-2xl p-6 border border-[var(--line)]">
      <h2 className="text-[var(--ink)] text-[22px] leading-tight mb-1">{titulo}</h2>
      {subtitulo && (
        <p className="font-sans text-[var(--ink-soft)] text-[13px] mb-5">{subtitulo}</p>
      )}
      <div className={subtitulo ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

function ToggleLinha({
  titulo,
  descricao,
  checked,
  onCheckedChange,
}: {
  titulo: string;
  descricao: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p className="font-sans text-[14px] font-medium text-[var(--ink)]">{titulo}</p>
        <p className="font-sans text-[12px] text-[var(--ink-soft)]">{descricao}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Campo({
  label,
  saved,
  children,
}: {
  label: string;
  saved?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center justify-between mb-2">
        <span className="font-semibold text-[9px] tracking-[1.5px] uppercase text-[var(--muted)] font-bold">
          {label}
        </span>
        {saved !== undefined && (
          <span
            className={`font-sans text-[12px] text-[var(--muted)] normal-case tracking-normal font-normal transition-opacity duration-200 ${
              saved ? "opacity-100" : "opacity-0"
            }`}
          >
            salvo
          </span>
        )}
      </p>
      {children}
    </div>
  );
}
