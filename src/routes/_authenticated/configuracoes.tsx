import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { z } from "zod";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { registrar, registrarEAguardar } from "@/lib/founder-eventos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toastErro, toastSucesso } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { statusAssinatura, cancelarAssinatura, abrirPortalCobranca } from "@/lib/stripe.functions";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { excluirMinhaConta } from "@/lib/conta.functions";
import {
  statusConexaoGoogle,
  iniciarConexaoGoogle,
  desconectarGoogle,
} from "@/lib/calendarGoogle.functions";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { FieldError } from "@/components/ui/FieldError";

const ERRO_AUTOSAVE =
  "A Pólia não conseguiu salvar agora. O que você digitou continua no campo, tenta de novo em instantes.";

const NOME_PLANO: Record<string, string> = {
  beta: "Plano de lançamento",
  confere: "Grátis",
  controle: "Premium",
  projete: "Pro",
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
  // Lido dentro do efeito de salvar sem entrar nas dependências dele: o efeito
  // é o debounce do campo, não pode re-rodar quando o perfil recarrega.
  const businessNameAtualRef = useRef(businessNameAtual);
  businessNameAtualRef.current = businessNameAtual;

  // Razão social + CNPJ: só usados no cabeçalho do Resumo pro contador
  // (Pro), mas coletados aqui sem gate de plano — dado útil de já ter
  // preenchido se ela upgradar depois.
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [razaoSocialSalvo, setRazaoSocialSalvo] = useState(false);
  const [cnpjSalvo, setCnpjSalvo] = useState(false);

  const [notifResumo, setNotifResumo] = useState(true);
  const [notifNovidades, setNotifNovidades] = useState(true);
  const [notifDicas, setNotifDicas] = useState(true);
  const plano = profileQuery.data?.plano ?? "beta";
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
        toastErro(res.error ?? "A Pólia não conseguiu conectar com o Google agora.");
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro("A Pólia não conseguiu iniciar a conexão com o Google."),
  });

  const desconectarGoogleMutation = useMutation({
    mutationFn: () => desconectarGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-status", userId] });
      toastSucesso("Google Calendar desconectado.");
    },
    onError: () => toastErro("A Pólia não conseguiu desconectar agora."),
  });

  // Portal da Stripe: sessão curta criada no servidor. Nenhum dado de cartão
  // passa pela Pólia. Abre em NOVA ABA (pedido da Sil, 05/10/2026), e a aba
  // nasce vazia no próprio clique: aberta só depois do await, o navegador
  // trataria como pop-up e bloquearia. Se o bloqueio acontecer mesmo assim,
  // cai no redirecionamento na mesma aba, que era o comportamento antigo.
  const abaPortalRef = useRef<Window | null>(null);
  const fecharAbaPortal = () => {
    abaPortalRef.current?.close();
    abaPortalRef.current = null;
  };
  const portalCobrancaMutation = useMutation({
    mutationFn: () => abrirPortalCobranca(),
    onSuccess: (res) => {
      if (res.error || !res.url) {
        fecharAbaPortal();
        toastErro(
          res.error ?? "A Pólia não conseguiu abrir a página de pagamento agora. Tenta de novo.",
        );
        return;
      }
      track("portal_cobranca_aberto");
      const aba = abaPortalRef.current;
      abaPortalRef.current = null;
      if (aba && !aba.closed) aba.location.href = res.url;
      else window.location.href = res.url;
    },
    onError: () => {
      fecharAbaPortal();
      toastErro("A Pólia não conseguiu abrir a página de pagamento agora. Tenta de novo.");
    },
  });
  const abrirPortal = () => {
    const aba = window.open("", "_blank");
    if (aba) {
      // A página da Stripe não precisa (nem deve) alcançar esta aba.
      aba.opener = null;
      aba.document.title = "Abrindo a página da Stripe…";
      aba.document.body.style.fontFamily = "Inter, system-ui, sans-serif";
      aba.document.body.textContent = "Abrindo a página segura da Stripe…";
    }
    abaPortalRef.current = aba;
    portalCobrancaMutation.mutate();
  };

  const cancelar = async () => {
    setCancelando(true);
    try {
      const resultado = await cancelarAssinatura();
      if (!resultado.ok) {
        toastErro(
          resultado.error ?? "A Pólia não conseguiu cancelar sua assinatura agora. Tenta de novo.",
        );
        return;
      }
      track("assinatura_cancelada");
      toastSucesso("Assinatura cancelada. Fica ativa até o fim do período já pago.");
      setConfirmandoCancelamento(false);
      invalidarAssinatura();
    } catch {
      toastErro("A Pólia não conseguiu cancelar sua assinatura agora. Tenta de novo.");
    } finally {
      setCancelando(false);
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
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: nome })
        .eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
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
      const criouNegocio = !businessNameAtualRef.current.trim() && nomeNegocio.trim().length > 0;
      const { error } = await supabase
        .from("profiles")
        .update({ business_name: nomeNegocio })
        .eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
      if (criouNegocio) void registrar("business_created", { feature: "configuracoes" });
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
      const { error } = await supabase
        .from("profiles")
        .update({ razao_social: razaoSocial })
        .eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
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
      const { error } = await supabase.from("profiles").update({ cnpj }).eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
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
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (error) {
      if (campo === "notif_resumo_semanal") setNotifResumo(!valor);
      if (campo === "notif_novidades") setNotifNovidades(!valor);
      if (campo === "notif_dicas") setNotifDicas(!valor);
      toastErro("A Pólia não conseguiu salvar essa preferência. Tenta de novo em instantes.");
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
          setEmailErro("A Pólia não conseguiu trocar o e-mail agora. Tenta de novo.");
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
    // Sem o try, uma exceção da server function (env var faltando, rede caindo)
    // deixava o botão travado em "excluindo" para sempre, sem dizer nada.
    let resultado: Awaited<ReturnType<typeof excluirMinhaConta>>;
    try {
      resultado = await excluirMinhaConta();
    } catch (err) {
      console.error("[Configurações] Falha ao chamar a exclusão de conta:", err);
      toastErro("A Pólia não conseguiu excluir a conta agora. Confere a internet e tenta de novo.");
      setExcluindo(false);
      return;
    }
    if (!resultado.ok) {
      toastErro(resultado.error ?? "A Pólia não conseguiu excluir a conta agora. Tenta de novo.");
      setExcluindo(false);
      return;
    }
    await registrarEAguardar("logout", { feature: "conta", propriedades: { motivo: "exclusao" } });
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
                className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
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
                      className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
                    />
                  </Campo>
                  <Campo
                    label="CONFIRMAR NOVO E-MAIL"
                    error={
                      novoEmail && confirmarEmail && novoEmail !== confirmarEmail
                        ? "os e-mails não coincidem"
                        : undefined
                    }
                  >
                    <input
                      type="email"
                      value={confirmarEmail}
                      onChange={(e) => setConfirmarEmail(e.target.value)}
                      className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
                    />
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
              placeholder="Ex: Ateliê Florescer · Estúdio da Lua · Doces da Rê"
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
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
              placeholder="Ex: Florescer Confecções e Serviços LTDA"
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
            />
            <p className="font-sans text-[var(--muted)] text-[11px] mt-1.5">
              usada no cabeçalho do Resumo pro contador (Pro)
            </p>
          </Campo>

          <Campo label="CNPJ" saved={cnpjSalvo}>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              maxLength={18}
              placeholder="00.000.000/0000-00"
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
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
                  className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
                />
              </Campo>
              <Campo
                label="CONFIRMAR NOVA SENHA"
                error={
                  novaSenha && confirmarSenha && novaSenha !== confirmarSenha
                    ? "as senhas não coincidem"
                    : undefined
                }
              >
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] transition-[border-color,box-shadow]"
                />
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
                      ? `Cancelada. Fica ativa até ${formatarData(assinatura.currentPeriodEnd)}. Depois, a conta volta pro plano Grátis.`
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
                  : "No plano Grátis agora. O Premium abre o Financeiro e os Clientes; o Pro acrescenta o Raio-x do mês, a projeção e o plano de conteúdo do ano."}
              </p>
              <LinkInterno
                href="/assinar"
                className="inline-block rounded-xl bg-[var(--secondary)] px-5 py-2.5 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] no-underline transition-colors hover:opacity-90"
              >
                Ver planos
              </LinkInterno>
            </>
          )}

          {!assinaturaQuery.isLoading && !assinatura?.ativa && plano === "beta" && (
            <p className="font-fraunces italic text-[15px] text-[var(--ink-soft)]">
              plano de lançamento: acesso completo, sem cobrança.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* PAY-06: até aqui não existia jeito nenhum de trocar cartão, e os
                e-mails de cobrança recusada mandavam pra esta tela. Só aparece
                pra quem já tem customer na Stripe. */}
            {!assinaturaQuery.isLoading && assinatura?.temCobranca && (
              <button
                type="button"
                onClick={abrirPortal}
                disabled={portalCobrancaMutation.isPending}
                className="rounded-xl border border-[var(--secondary)] px-4 py-2 font-sans text-[13px] text-[var(--secondary-text)] transition-colors hover:bg-[var(--secondary-light)] disabled:opacity-50"
              >
                {portalCobrancaMutation.isPending ? "Abrindo..." : "Gerenciar assinatura"}
              </button>
            )}
            {assinatura?.ativa && !assinatura.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={() => setConfirmandoCancelamento(true)}
                className="rounded-xl border border-[var(--line)] px-4 py-2 font-sans text-[13px] text-[var(--ink-soft)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Cancelar assinatura
              </button>
            )}
            {/* Modal em vez de confirmação inline (pedido da Sil, 05/10/2026): a
                frase solta abaixo do botão passava despercebida, e quem cancela
                precisa ler que a conta volta pro Grátis antes de confirmar. */}
            <ConfirmarAcao
              open={confirmandoCancelamento}
              onOpenChange={(aberto) => {
                if (!cancelando) setConfirmandoCancelamento(aberto);
              }}
              titulo="Cancelar a assinatura?"
              descricao={
                <>
                  O {NOME_PLANO[plano] ?? "plano"} continua ativo até{" "}
                  {assinatura?.currentPeriodEnd
                    ? formatarData(assinatura.currentPeriodEnd)
                    : "o fim do período já pago"}
                  . Depois, a conta volta pro plano Grátis: os dados continuam guardados, e as telas
                  do plano pago deixam de abrir. Não tem nova cobrança.
                </>
              }
              textoCancelar="Manter assinatura"
              textoConfirmar="Cancelar assinatura"
              textoCarregando="Cancelando…"
              destrutivo
              carregando={cancelando}
              onConfirmar={cancelar}
            />
            {/* Recibo em PDF saiu (CFG-02): a emissão virou nota fiscal de
                verdade, mandada direto pro e-mail cadastrado, então não tem
                mais nada pra baixar aqui dentro — só o aviso. Mesma
                pré-condição de antes (plano pago, com cobrança de verdade). */}
            {!assinaturaQuery.isLoading && plano !== "beta" && assinatura?.preco && (
              <p className="max-w-[52ch] font-sans text-[13px] text-[var(--ink-soft)]">
                A nota fiscal da sua assinatura é emitida automaticamente e chega no e-mail
                cadastrado aqui na Pólia.
              </p>
            )}
          </div>

          {!assinaturaQuery.isLoading && assinatura?.temCobranca && (
            <p className="mt-3 max-w-[52ch] font-sans text-[13px] text-[var(--ink-soft)]">
              Trocar o cartão, ver as faturas e mudar entre Premium e Pro acontece na página segura
              da Stripe, que abre numa nova aba.
            </p>
          )}
        </Secao>

        {/* SEÇÃO 7 — AJUDA */}
        <Secao titulo="Ajuda">
          <p className="font-fraunces italic text-[15px] text-[var(--ink-soft)] mb-4">
            dúvida rápida, a Ajuda responde. Coisa que precisa de acompanhamento, abre um chamado.
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkInterno
              href="/ajuda#contato"
              className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 font-sans text-[13px] text-[var(--ink)] no-underline transition-colors hover:border-[var(--secondary)]"
            >
              Central de ajuda
            </LinkInterno>
            <LinkInterno
              href="/chamados"
              className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 font-sans text-[13px] text-[var(--ink)] no-underline transition-colors hover:border-[var(--secondary)]"
            >
              Seus chamados
            </LinkInterno>
          </div>
        </Secao>

        {/* SEÇÃO 8 — ZONA DE PERIGO */}
        <section className="mb-8 rounded-2xl border border-[var(--danger)] bg-[var(--danger-soft)] p-6">
          <h2 className="text-[22px] leading-tight text-[var(--danger)]">Excluir conta</h2>
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
                className="w-full h-[48px] border border-[var(--danger)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] outline-none focus:shadow-[0_0_0_3px_var(--danger-soft)] transition-[border-color,box-shadow]"
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
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={titulo} />
    </div>
  );
}

// Elementos nativos que um <label htmlFor> consegue de fato associar.
const CAMPO_ELEMENTOS_ASSOCIAVEIS = new Set(["input", "textarea", "select"]);

function Campo({
  label,
  saved,
  error,
  children,
}: {
  label: string;
  saved?: boolean;
  /** Mensagem de erro de validação. Liga ao primeiro filho associável via aria-describedby/aria-invalid. */
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-erro`;
  // Alguns usos deste Campo embrulham só o input (associa de verdade); outros
  // embrulham um <div> de exibição sem controle nenhum (ex: bloco de e-mail),
  // então só clonamos o primeiro filho com o id quando ele é mesmo um campo
  // nativo — senão o label vira <span>, sem htmlFor pra um alvo que não existe.
  const filhos = Children.toArray(children);
  const [primeiroFilho, ...demaisFilhos] = filhos;
  const associavel =
    isValidElement(primeiroFilho) &&
    typeof primeiroFilho.type === "string" &&
    CAMPO_ELEMENTOS_ASSOCIAVEIS.has(primeiroFilho.type);
  const conteudo = associavel
    ? [
        cloneElement(
          primeiroFilho as ReactElement<{
            id?: string;
            "aria-describedby"?: string;
            "aria-invalid"?: boolean;
          }>,
          {
            id,
            "aria-describedby": error ? errorId : undefined,
            "aria-invalid": error ? true : undefined,
          },
        ),
        ...demaisFilhos,
      ]
    : filhos;

  return (
    <div>
      <p className="flex items-center justify-between mb-2">
        {associavel ? (
          <label
            htmlFor={id}
            className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]"
          >
            {label}
          </label>
        ) : (
          <span className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            {label}
          </span>
        )}
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
      {conteudo}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
