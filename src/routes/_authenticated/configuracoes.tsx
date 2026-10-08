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
import { BotaoReverTour } from "@/components/dicas/BotaoReverTour";
import { FieldError } from "@/components/ui/FieldError";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { PasswordRequirements } from "@/components/cosmic/CosmicInput";
import { MSG_REQUISITOS_SENHA, mensagemErroNovaSenha, senhaCumpreRequisitos } from "@/lib/senha";

const ERRO_AUTOSAVE =
  "A Pólia One não conseguiu salvar agora. O que você digitou continua no campo, tenta de novo em instantes.";

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
      { title: "Configurações · Pólia One" },
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
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "full_name, business_name, business_type, razao_social, cnpj, streak, notif_resumo_semanal, notif_novidades, notif_dicas, plano",
        )
        .eq("id", userId!)
        .maybeSingle();
      // Erro engolido deixava o formulário vazio e o autosave desligado, sem
      // aviso nenhum: ela digitava e nada era salvo. Agora vira estado de erro.
      if (error) throw error;
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
  // Sem default (QA-37): o "beta" de antes fazia a seção Assinatura mostrar
  // "Plano de lançamento" pra quem é Grátis ou Premium enquanto o perfil
  // carregava. null = ainda não se sabe.
  const plano: string | null = profileQuery.data?.plano ?? null;
  const nomePlano = plano ? (NOME_PLANO[plano] ?? plano) : null;
  const queryClient = useQueryClient();

  const assinaturaQuery = useQuery({
    queryKey: ["assinatura-status", userId],
    enabled: !!userId,
    queryFn: () => statusAssinatura(),
  });
  const assinatura = assinaturaQuery.data;
  // A seção Assinatura depende dos dois: do status na Stripe e do plano no perfil.
  const assinaturaCarregando = assinaturaQuery.isLoading || profileQuery.isLoading;

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
        toastErro(res.error ?? "A Pólia One não conseguiu conectar com o Google agora.");
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro("A Pólia One não conseguiu iniciar a conexão com o Google."),
  });

  const desconectarGoogleMutation = useMutation({
    mutationFn: () => desconectarGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-status", userId] });
      toastSucesso("Google Calendar desconectado.");
    },
    onError: () => toastErro("A Pólia One não conseguiu desconectar agora."),
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
          res.error ??
            "A Pólia One não conseguiu abrir a página de pagamento agora. Tenta de novo.",
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
      toastErro("A Pólia One não conseguiu abrir a página de pagamento agora. Tenta de novo.");
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
          resultado.error ??
            "A Pólia One não conseguiu cancelar sua assinatura agora. Tenta de novo.",
        );
        return;
      }
      track("assinatura_cancelada");
      toastSucesso("Assinatura cancelada. Fica ativa até o fim do período já pago.");
      setConfirmandoCancelamento(false);
      invalidarAssinatura();
    } catch {
      toastErro("A Pólia One não conseguiu cancelar sua assinatura agora. Tenta de novo.");
    } finally {
      setCancelando(false);
    }
  };

  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [senhaOk, setSenhaOk] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

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

  // QA-37 (08/10/2026): o perfil enche o formulário UMA vez por conta. Antes
  // este efeito rodava a cada refetch (o React Query recarrega ao voltar pra
  // aba), e o valor do servidor sobrescrevia o que ela estava digitando.
  // `persistidoRef` guarda o último valor que o banco tem de cada campo: o
  // autosave só grava quando o campo difere dele. Sem isso, encher o
  // formulário no carregamento já disparava a gravação dos quatro campos.
  const carregadoParaRef = useRef<string | null>(null);
  const persistidoRef = useRef({ full_name: "", business_name: "", razao_social: "", cnpj: "" });
  useEffect(() => {
    const p = profileQuery.data;
    if (!p || !userId || carregadoParaRef.current === userId) return;
    carregadoParaRef.current = userId;
    persistidoRef.current = {
      full_name: p.full_name ?? "",
      business_name: p.business_name ?? "",
      razao_social: p.razao_social ?? "",
      cnpj: p.cnpj ?? "",
    };
    setNome(p.full_name ?? "");
    setNomeNegocio(p.business_name ?? "");
    setRazaoSocial(p.razao_social ?? "");
    setCnpj(p.cnpj ?? "");
    setNotifResumo(p.notif_resumo_semanal ?? true);
    setNotifNovidades(p.notif_novidades ?? true);
    setNotifDicas(p.notif_dicas ?? true);
    carregouInicial.current = true;
  }, [profileQuery.data, userId]);

  useEffect(() => {
    if (!userId || !carregouInicial.current) return;
    if (nome === persistidoRef.current.full_name) return;
    if (nomeTimer.current) clearTimeout(nomeTimer.current);
    nomeTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: nome })
        .eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
      persistidoRef.current.full_name = nome;
      setNomeSalvo(true);
      setTimeout(() => setNomeSalvo(false), 1600);
    }, 600);
    return () => {
      if (nomeTimer.current) clearTimeout(nomeTimer.current);
    };
  }, [nome, userId]);

  useEffect(() => {
    if (!userId || !carregouInicial.current) return;
    if (nomeNegocio === persistidoRef.current.business_name) return;
    if (nomeNegocioTimer.current) clearTimeout(nomeNegocioTimer.current);
    nomeNegocioTimer.current = setTimeout(async () => {
      const criouNegocio = !businessNameAtualRef.current.trim() && nomeNegocio.trim().length > 0;
      const { error } = await supabase
        .from("profiles")
        .update({ business_name: nomeNegocio })
        .eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
      persistidoRef.current.business_name = nomeNegocio;
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
    if (razaoSocial === persistidoRef.current.razao_social) return;
    if (razaoSocialTimer.current) clearTimeout(razaoSocialTimer.current);
    razaoSocialTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ razao_social: razaoSocial })
        .eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
      persistidoRef.current.razao_social = razaoSocial;
      setRazaoSocialSalvo(true);
      setTimeout(() => setRazaoSocialSalvo(false), 1600);
    }, 600);
    return () => {
      if (razaoSocialTimer.current) clearTimeout(razaoSocialTimer.current);
    };
  }, [razaoSocial, userId]);

  useEffect(() => {
    if (!userId || !carregouInicial.current) return;
    if (cnpj === persistidoRef.current.cnpj) return;
    if (cnpjTimer.current) clearTimeout(cnpjTimer.current);
    cnpjTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("profiles").update({ cnpj }).eq("id", userId);
      if (error) return toastErro(ERRO_AUTOSAVE);
      persistidoRef.current.cnpj = cnpj;
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
      toastErro("A Pólia One não conseguiu salvar essa preferência. Tenta de novo em instantes.");
    }
  };

  const alterarSenha = async () => {
    setSenhaErro(null);
    setSenhaOk(false);
    // Mesma régua do cadastro e da redefinição (antes aqui era só 8 caracteres).
    if (!senhaCumpreRequisitos(novaSenha)) {
      setSenhaErro(MSG_REQUISITOS_SENHA);
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaErro("As senhas não coincidem.");
      return;
    }
    setSalvandoSenha(true);
    let error: Awaited<ReturnType<typeof supabase.auth.updateUser>>["error"] = null;
    try {
      ({ error } = await supabase.auth.updateUser({ password: novaSenha }));
    } catch {
      setSenhaErro("A Pólia One não conseguiu trocar a senha. Confere a internet e tenta de novo.");
      return;
    } finally {
      setSalvandoSenha(false);
    }
    if (error) {
      // A mensagem do Supabase vem em inglês e técnica; nunca vai crua pra tela.
      console.error("senha_alterar", error);
      setSenhaErro(
        mensagemErroNovaSenha(error) ??
          "A Pólia One não conseguiu trocar a senha. Tenta de novo em instantes.",
      );
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
      // Os links de confirmação (no e-mail atual e no novo) voltam pra cá, não
      // pra home.
      const { error } = await supabase.auth.updateUser(
        { email: parsed.data },
        { emailRedirectTo: `${window.location.origin}/configuracoes` },
      );
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          setEmailErro("Esse e-mail já está em uso por outra conta.");
        } else {
          setEmailErro("A Pólia One não conseguiu trocar o e-mail agora. Tenta de novo.");
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
      toastErro(
        "A Pólia One não conseguiu excluir a conta agora. Confere a internet e tenta de novo.",
      );
      setExcluindo(false);
      return;
    }
    if (!resultado.ok) {
      toastErro(
        resultado.error ?? "A Pólia One não conseguiu excluir a conta agora. Tenta de novo.",
      );
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
          {profileQuery.isError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--danger-soft)] p-4"
            >
              <p className="font-sans text-[14px] text-[var(--ink)]">
                A Pólia One não conseguiu carregar o seu perfil. Enquanto não carregar, o que for
                digitado aqui não é salvo.
              </p>
              <button
                type="button"
                onClick={() => void profileQuery.refetch()}
                disabled={profileQuery.isFetching}
                className={`${BTN_MIUDO} mt-3`}
              >
                {profileQuery.isFetching ? "Tentando..." : "Tentar de novo"}
              </button>
            </div>
          )}
          <div className="space-y-5">
            <Campo label="SEU NOME" saved={nomeSalvo}>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                placeholder="Seu nome"
                className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
              />
            </Campo>
            <Campo label="E-MAIL">
              <div className="w-full h-[48px] flex items-center justify-between bg-[var(--surface)] border border-[var(--line)] rounded-xl px-4">
                <span className="font-sans text-[var(--ink-soft)] text-[15px]">{email}</span>
                {!alterandoEmail && (
                  <button
                    type="button"
                    onClick={() => setAlterandoEmail(true)}
                    className="inline-flex min-h-11 items-center font-sans text-[13px] text-[var(--secondary-text)] hover:underline"
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
                      className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
                    />
                  </Campo>
                  <Campo
                    label="CONFIRMAR NOVO E-MAIL"
                    error={
                      novoEmail && confirmarEmail && novoEmail !== confirmarEmail
                        ? "Os e-mails não coincidem."
                        : undefined
                    }
                  >
                    <input
                      type="email"
                      value={confirmarEmail}
                      onChange={(e) => setConfirmarEmail(e.target.value)}
                      className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
                    />
                  </Campo>
                  {emailErro && (
                    <p role="alert" className="font-sans text-[var(--danger)] text-[12px]">
                      {emailErro}
                    </p>
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
                      className={BTN_ACAO_CONTORNO}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={alterarEmail}
                      disabled={salvandoEmail || !novoEmail || novoEmail !== confirmarEmail}
                      className={BTN_ACAO}
                    >
                      {salvandoEmail ? "Enviando..." : "Confirmar troca"}
                    </button>
                  </div>
                </div>
              )}
              {emailOk && (
                <p role="status" className="font-sans text-[15px] text-[var(--ink-soft)] mt-3">
                  Chega um link no e-mail atual e outro no novo; a troca vale depois de confirmar os
                  dois.
                </p>
              )}
              {!alterandoEmail && !emailOk && (
                <p className="font-sans text-[var(--muted)] text-[11px] mt-1.5">
                  A troca só vale depois de confirmar os links no e-mail atual e no novo.
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
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
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
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
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
              className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
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
                  className={`${BTN_MIUDO} hover:border-[var(--danger)] hover:text-[var(--danger)]`}
                >
                  {desconectarGoogleMutation.isPending ? "Desconectando..." : "Desconectar"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => conectarGoogleMutation.mutate()}
                  disabled={conectarGoogleMutation.isPending}
                  className={BTN_MIUDO}
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
              <button type="button" onClick={() => setAlterandoSenha(true)} className={BTN_MIUDO}>
                Alterar senha
              </button>
            )}
          </div>

          {alterandoSenha && (
            <div className="space-y-4 mt-6 pt-6 border-t border-[var(--line)]">
              <Campo label="NOVA SENHA">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={8}
                  aria-describedby="config-senha-requisitos"
                  className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
                />
                <PasswordRequirements id="config-senha-requisitos" password={novaSenha} />
              </Campo>
              <Campo
                label="CONFIRMAR NOVA SENHA"
                error={
                  novaSenha && confirmarSenha && novaSenha !== confirmarSenha
                    ? "As senhas não coincidem."
                    : undefined
                }
              >
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow]"
                />
              </Campo>
              {senhaErro && (
                <p role="alert" className="font-sans text-[var(--danger)] text-[12px]">
                  {senhaErro}
                </p>
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
                  className={BTN_ACAO_CONTORNO}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={alterarSenha}
                  disabled={
                    salvandoSenha ||
                    !senhaCumpreRequisitos(novaSenha) ||
                    novaSenha !== confirmarSenha
                  }
                  className={BTN_ACAO}
                >
                  {salvandoSenha ? "Salvando..." : "Salvar nova senha"}
                </button>
              </div>
            </div>
          )}
          {senhaOk && (
            <p className="font-sans text-[15px] text-[var(--ink-soft)] mt-3">Senha atualizada.</p>
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
              titulo="Novidades da Pólia One"
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
          {assinaturaCarregando && (
            <p className="font-sans text-[13px] text-[var(--muted)]">Carregando...</p>
          )}

          {!assinaturaCarregando && assinatura?.ativa && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block rounded bg-[var(--secondary)] px-2.5 py-1 text-[10px] font-accent font-bold uppercase tracking-[1px] text-[var(--secondary-ink)]">
                    {nomePlano ?? "Assinatura ativa"}
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

          {/* Premium ou Pro liberado pela Pólia (convite), sem assinatura no
              Stripe: antes caía no texto do Grátis (08/10/2026). */}
          {!assinaturaCarregando &&
            !assinatura?.ativa &&
            (plano === "controle" || plano === "projete") && (
              <>
                <p className="mb-4 font-sans text-[15px] text-[var(--ink-soft)]">
                  {plano === "controle"
                    ? "Plano Premium liberado pela Pólia, sem cobrança. O Pro acrescenta o Raio-x do mês, a projeção e o plano de conteúdo do ano."
                    : "Plano Pro liberado pela Pólia, sem cobrança."}
                </p>
                {plano === "controle" && (
                  <LinkInterno href="/upgrade?tier=projete" className={BTN_ACAO}>
                    Conhecer o Pro
                  </LinkInterno>
                )}
              </>
            )}

          {!assinaturaCarregando &&
            !assinatura?.ativa &&
            plano !== null &&
            plano !== "beta" &&
            plano !== "controle" &&
            plano !== "projete" && (
              <>
                <p className="font-sans text-[15px] text-[var(--ink-soft)] mb-4">
                  {plano === "cancelada"
                    ? "Sua assinatura foi cancelada. Dá pra assinar de novo quando quiser."
                    : "No plano Grátis agora. O Premium abre o Financeiro e os Clientes; o Pro acrescenta o Raio-x do mês, a projeção e o plano de conteúdo do ano."}
                </p>
                <LinkInterno href="/assinar" className={BTN_ACAO}>
                  Ver planos
                </LinkInterno>
              </>
            )}

          {!assinaturaCarregando && !assinatura?.ativa && plano === "beta" && (
            <p className="font-sans text-[15px] text-[var(--ink-soft)]">
              Plano de lançamento: acesso completo, sem cobrança.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* PAY-06: até aqui não existia jeito nenhum de trocar cartão, e os
                e-mails de cobrança recusada mandavam pra esta tela. Só aparece
                pra quem já tem customer na Stripe. */}
            {!assinaturaCarregando && assinatura?.temCobranca && (
              <button
                type="button"
                onClick={abrirPortal}
                disabled={portalCobrancaMutation.isPending}
                className={BTN_MIUDO}
              >
                {portalCobrancaMutation.isPending ? "Abrindo..." : "Gerenciar assinatura"}
              </button>
            )}
            {assinatura?.ativa && !assinatura.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={() => setConfirmandoCancelamento(true)}
                className={`${BTN_MIUDO} !border-[var(--danger)] !text-[var(--danger)]`}
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
                  O {nomePlano ?? "plano"} continua ativo até{" "}
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
            {!assinaturaCarregando && plano !== "beta" && assinatura?.preco && (
              <p className="max-w-[52ch] font-sans text-[13px] text-[var(--ink-soft)]">
                A nota fiscal da sua assinatura é emitida automaticamente e chega no e-mail
                cadastrado aqui na Pólia One.
              </p>
            )}
          </div>

          {!assinaturaCarregando && assinatura?.temCobranca && (
            <p className="mt-3 max-w-[52ch] font-sans text-[13px] text-[var(--ink-soft)]">
              Trocar o cartão, ver as faturas e mudar entre Premium e Pro acontece na página segura
              da Stripe, que abre numa nova aba.
            </p>
          )}
        </Secao>

        {/* SEÇÃO 7 — AJUDA */}
        <Secao titulo="Ajuda">
          <p className="font-sans text-[15px] text-[var(--ink-soft)] mb-4">
            Dúvida rápida, a Ajuda responde. Coisa que precisa de acompanhamento, abre um chamado.
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkInterno href="/ajuda#contato" className={BTN_MIUDO}>
              Central de ajuda
            </LinkInterno>
            <LinkInterno href="/chamados" className={BTN_MIUDO}>
              Seus chamados
            </LinkInterno>
            <LinkInterno href="/como-usar" className={BTN_MIUDO}>
              Assistir o tutorial
            </LinkInterno>
            <BotaoReverTour className={BTN_MIUDO} />
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
              className={`${BTN_MIUDO} mt-4 bg-white !border-[var(--danger)] !text-[var(--danger)]`}
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
                  className={BTN_ACAO_CONTORNO}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={pedirExclusao}
                  disabled={!confirmacaoBate || excluindo}
                  className={`${BTN_ACAO_CONTORNO} bg-white !border-[var(--danger)] !text-[var(--danger)]`}
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
            // Soma ao describedby que o campo já tinha (ex.: requisitos da
            // senha), em vez de apagar.
            "aria-describedby":
              [
                error ? errorId : null,
                (primeiroFilho as ReactElement<{ "aria-describedby"?: string }>).props[
                  "aria-describedby"
                ],
              ]
                .filter(Boolean)
                .join(" ") || undefined,
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
            className="text-[12px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]"
          >
            {label}
          </label>
        ) : (
          <span className="text-[12px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
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
