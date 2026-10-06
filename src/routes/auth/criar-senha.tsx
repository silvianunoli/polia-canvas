import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { User } from "lucide-react";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthButton, SerifHeadline, SubText } from "@/components/cosmic/AuthShell";
import { CosmicInput, PasswordRequirements, CapsLockHint } from "@/components/cosmic/CosmicInput";
import { useCapsLockWarning } from "@/hooks/useCapsLockWarning";
import { META_PRECISA_CRIAR_SENHA, senhaCumpreRequisitos } from "@/lib/senha";

// Primeira entrada de quem comprou em /planos sem ter conta. O e-mail "Sua
// compra foi confirmada" traz um convite do Supabase que só faz login; sem
// esta tela a pessoa usava a Pólia One uma vez e, ao sair, não tinha senha pra
// voltar (QA-03, 05/10/2026). Também pergunta o nome, que a compra não coleta.
export const Route = createFileRoute("/auth/criar-senha")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Criar senha · Pólia" },
      { name: "description", content: "Senha de acesso à Pólia One." },
    ],
  }),
  component: CriarSenhaPage,
});

function CriarSenhaPage() {
  const navigate = useNavigate();
  const [pronta, setPronta] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [nomeErro, setNomeErro] = useState<string | undefined>(undefined);
  const [senhaInvalida, setSenhaInvalida] = useState(false);
  const [confirmaErro, setConfirmaErro] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const caps = useCapsLockWarning();
  const nomeRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const confirmaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("otp_expired") || hash.includes("access_denied")) {
      navigate({ to: "/auth/link-expirado", search: { tipo: "convite" } });
      return;
    }

    let resolvido = false;
    function usarSessao(user: { email?: string; user_metadata?: Record<string, unknown> }) {
      if (resolvido) return;
      resolvido = true;
      setEmail(user.email ?? null);
      const nomeAtual = user.user_metadata?.full_name;
      if (typeof nomeAtual === "string") setNome(nomeAtual);
      setPronta(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) usarSessao(session.user);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) usarSessao(data.session.user);
    });

    // O convite chega com o token no hash; se em alguns segundos não virou
    // sessão, o link venceu ou já foi usado.
    const t = setTimeout(async () => {
      if (resolvido) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) usarSessao(data.session.user);
      else navigate({ to: "/auth/link-expirado", search: { tipo: "convite" } });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNomeErro(undefined);
    setConfirmaErro(undefined);
    const nomeLimpo = nome.trim();
    const senhaOk = senhaCumpreRequisitos(senha);
    setSenhaInvalida(!senhaOk);
    if (nomeLimpo.length < 2) {
      setNomeErro("Falta o seu nome.");
      nomeRef.current?.focus();
      return;
    }
    if (!senhaOk) {
      senhaRef.current?.focus();
      return;
    }
    if (senha !== confirma) {
      setConfirmaErro("As senhas não coincidem.");
      confirmaRef.current?.focus();
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: { full_name: nomeLimpo, [META_PRECISA_CRIAR_SENHA]: false },
    });
    if (error) {
      setLoading(false);
      toastErro("A Pólia não conseguiu salvar a senha agora. Tenta de novo em alguns segundos.");
      return;
    }
    navigate({ to: "/onboarding" });
  }

  if (!pronta) {
    return (
      <AuthShell maxWidth={420}>
        <SerifHeadline size={26}>Abrindo a sua conta.</SerifHeadline>
        <SubText>Só um instante.</SubText>
      </AuthShell>
    );
  }

  return (
    <AuthShell maxWidth={420}>
      <SerifHeadline size={26}>Falta só a sua senha.</SerifHeadline>
      <SubText>
        {email
          ? `A compra está confirmada. A senha é o que abre a Pólia One da próxima vez, junto com ${email}.`
          : "A compra está confirmada. A senha é o que abre a Pólia One da próxima vez."}
      </SubText>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
        <CosmicInput
          ref={nomeRef}
          label="Seu nome"
          name="nome"
          autoComplete="name"
          placeholder="como prefere ser chamada"
          icon={<User size={18} />}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            if (nomeErro) setNomeErro(undefined);
          }}
          error={nomeErro}
          reserveErrorSpace
          disabled={loading}
        />
        <div>
          <CosmicInput
            ref={senhaRef}
            label="Crie uma senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            placeholder="crie uma senha segura"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setSenhaInvalida(false);
            }}
            onKeyUp={caps.onKeyUp}
            invalid={senhaInvalida}
            aria-describedby="senha-requisitos"
            disabled={loading}
          />
          <CapsLockHint ligado={caps.ligado} />
          <PasswordRequirements id="senha-requisitos" password={senha} />
        </div>
        <CosmicInput
          ref={confirmaRef}
          label="Confirme a senha"
          name="confirma"
          type="password"
          autoComplete="new-password"
          placeholder="a mesma senha"
          value={confirma}
          onChange={(e) => {
            setConfirma(e.target.value);
            if (confirmaErro) setConfirmaErro(undefined);
          }}
          error={confirmaErro}
          reserveErrorSpace
          disabled={loading}
        />

        <div className="mt-1">
          <AuthButton type="submit" fullWidth loading={loading}>
            {loading ? (
              "Salvando..."
            ) : (
              <>
                Salvar e entrar <span aria-hidden="true">→</span>
              </>
            )}
          </AuthButton>
        </div>
      </form>
    </AuthShell>
  );
}
