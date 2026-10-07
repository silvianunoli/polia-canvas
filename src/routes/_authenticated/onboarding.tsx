import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { supabase } from "@/integrations/supabase/client";
import { garantirBoasVindas } from "@/lib/boas-vindas.functions";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { BTN_MIUDO, BTN_PRIMARIO } from "@/lib/botoes";

// O passo mora na URL (?passo=3) desde 07/10/2026 (ONE-23): o voltar do
// navegador recua um passo em vez de sair do fluxo.
type OnboardingSearch = { passo?: number };
const ULTIMO_PASSO = 5;

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => {
    const n = Number(search.passo);
    return Number.isInteger(n) && n >= 2 && n <= ULTIMO_PASSO ? { passo: n } : {};
  },
  head: () => ({ meta: [{ title: "Onboarding · Pólia One" }] }),
  beforeLoad: async ({ cause }) => {
    if (typeof window === "undefined") return;
    // Só na ENTRADA da rota. Com "stay" (o router.invalidate que roda a cada
    // renovação de login), quem estava nos passos 5 e 6 era jogada pro Painel:
    // o onboarding_completed vira true já no passo 4.
    if (cause === "stay") return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", sess.session.user.id)
      .maybeSingle();
    if (!data?.onboarding_completed) return;
    const { data: assinatura } = await supabase
      .from("assinaturas" as never)
      .select("status")
      .eq("user_id", sess.session.user.id)
      .maybeSingle();
    const status = (assinatura as { status: string } | null)?.status;
    const ativa = status ? ["active", "past_due", "trialing"].includes(status) : false;
    throw redirect({ to: ativa ? "/painel" : "/assinar" });
  },
  component: OnboardingPage,
});

type BusinessType = "produto_fisico" | "produto_digital" | "servico" | "hibrido";
type BusinessStage = "ideia" | "comecei" | "ja_vendo";

interface OnboardingState {
  business_type: BusinessType | null;
  business_stage: BusinessStage | null;
  business_name: string;
  // Passo 4 — o que vende e entrega (varia por tipo)
  c1: string;
  c2: string;
  toggle: string;
  hp: string; // híbrido: o que recebe na frente produto
  hs: string; // híbrido: o que recebe na frente serviço
}

// As respostas vivem só na memória da tela. Se a URL pede um passo cujas
// respostas anteriores não existem (recarregou no meio, colou o link), volta
// pro primeiro passo que falta responder.
function passoPossivel(pedido: number, state: OnboardingState, salvo: boolean): number {
  if (pedido >= 3 && !state.business_type) return 2;
  if (pedido >= 4 && !state.business_stage) return 3;
  if (pedido >= 5 && !salvo) return 4;
  return pedido;
}

function OnboardingPage() {
  const { passo } = Route.useSearch();
  const router = useRouter();
  const [salvo, setSalvo] = useState(false);
  const [state, setState] = useState<OnboardingState>({
    business_type: null,
    business_stage: null,
    business_name: "",
    c1: "",
    c2: "",
    toggle: "",
    hp: "",
    hs: "",
  });
  const navigate = useNavigate();
  const step = passoPossivel(passo ?? 1, state, salvo);

  useEffect(() => {
    if (step !== (passo ?? 1)) {
      void navigate({ to: "/onboarding", search: step > 1 ? { passo: step } : {}, replace: true });
    }
  }, [step, passo, navigate]);

  const setStep = (n: number) => {
    void navigate({ to: "/onboarding", search: n > 1 ? { passo: n } : {} });
  };
  // Mesmo efeito do voltar do navegador quando dá; se a aba abriu direto num
  // passo (sem histórico), troca o passo sem empilhar entrada nova.
  const voltar = () => {
    if (router.history.canGoBack()) router.history.back();
    else
      void navigate({
        to: "/onboarding",
        search: step - 1 > 1 ? { passo: step - 1 } : {},
        replace: true,
      });
  };

  // Best-effort, silencioso: se falhar, não atrapalha o onboarding. A função
  // só marca a conta como notificada quando o e-mail sai de verdade, então um
  // envio que falhou é tentado de novo no próximo load — de propósito.
  useEffect(() => {
    garantirBoasVindas().catch(() => {});
  }, []);

  return (
    <div className="polia-v3 min-h-screen w-full bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full px-5 pb-10 pt-6">
        {step > 1 && <StepIndicator step={step} />}
        {/* O passo 4 grava com upsert, então voltar da tela final e salvar de
            novo só atualiza o perfil, não duplica nada. */}
        {step >= 2 && (
          <div className="mx-auto mt-2 w-full max-w-[900px]">
            <button
              type="button"
              onClick={voltar}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[14px] text-[var(--secondary-text)] hover:underline"
            >
              <span aria-hidden="true">←</span> Voltar
            </button>
          </div>
        )}
        <div className="mx-auto w-full max-w-[900px]">
          {step === 1 && (
            <Step1
              onNext={() => {
                void registrar("onboarding_started", { feature: "onboarding" });
                setStep(2);
              }}
            />
          )}
          {step === 2 && (
            <Step2
              value={state.business_type}
              onSelect={(v) => setState((s) => ({ ...s, business_type: v }))}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3
              value={state.business_stage}
              onSelect={(v) => setState((s) => ({ ...s, business_stage: v }))}
              onNext={() => setStep(4)}
            />
          )}
          {/* O passo "quanto cobra e quanto custa" saiu em 05/10/2026 (decisão
              da Sil): quase ninguém vende um produto só, e o número entra
              depois, na Calculadora e em Produtos. */}
          {step === 4 && (
            <Step4
              state={state}
              setState={setState}
              jaSalvo={salvo}
              onSuccess={() => {
                setSalvo(true);
                setStep(5);
              }}
            />
          )}
          {/* Termina na Calculadora, não no Painel vazio (06/10/2026): é o
              valor mais rápido do produto e o caminho que a landing promete. */}
          {step === 5 && (
            <StepFinal
              tipo={state.business_type}
              onFinish={() => navigate({ to: "/calculadora" })}
              onPlanejamento={() => navigate({ to: "/planejamento" })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <p className="text-center text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
      Passo {step} de 5
    </p>
  );
}

function LogoPlaceholder() {
  return <PoliaWordmark className="mx-auto h-8 w-auto" />;
}

function Manuscrito({ children }: { children: React.ReactNode }) {
  return <p className="anzylna-decorativo text-center text-[var(--ink-soft)]">{children}</p>;
}

function Headline({ children, size = 64 }: { children: React.ReactNode; size?: number }) {
  return (
    <h1
      className="text-center font-cabinet text-[var(--ink)]"
      style={{
        fontSize: `clamp(${Math.round(size * 0.55)}px, 6vw, ${size}px)`,
        lineHeight: 1.15,
      }}
    >
      {children}
    </h1>
  );
}

function Body({ children, max = 600 }: { children: React.ReactNode; max?: number }) {
  return (
    <p
      className="mx-auto text-center text-[var(--ink-soft)]"
      style={{ fontSize: 17, lineHeight: "28px", maxWidth: max }}
    >
      {children}
    </p>
  );
}

function PrimaryCTA({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  // Sem largura fixa: o botão acompanha o rótulo. Com 270px cravados,
  // "Quero contar da minha marca →" quebrava em duas linhas.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BTN_PRIMARIO} mx-auto`}
    >
      {children}
    </button>
  );
}

/* ---------------- STEP 1 ---------------- */
function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 pt-4">
      <LogoPlaceholder />
      <div className="flex flex-col items-center gap-4">
        <Manuscrito>Que bom ter você aqui</Manuscrito>
        <Headline size={64}>Bem-vinda à Pólia One</Headline>
      </div>
      <div className="flex flex-col gap-1">
        <Body>
          A Pólia One te leva do primeiro passo até a primeira ferramenta da sua marca, pronta pra
          usar.
        </Body>
        <Body>Sem curso e sem teoria solta, é direção do começo ao fim.</Body>
      </div>
      <PrimaryCTA onClick={onNext}>Quero contar da minha marca →</PrimaryCTA>
      <p className="text-center text-[14px] text-[var(--muted)]">Leva só 3 minutinhos</p>
    </div>
  );
}

/* ---------------- STEP 2 ---------------- */
const BIZ_TYPES: { value: BusinessType; tag: string; title: string; desc: string }[] = [
  {
    value: "produto_fisico",
    tag: "Produto Físico",
    title: "Algo que vai pelo correio",
    desc: "Roupa, comida, joia, cosmético, artesanato. Tem estoque, tem envio.",
  },
  {
    value: "produto_digital",
    tag: "Produto Digital",
    title: "Algo que se baixa ou se acessa",
    desc: "Curso, ebook, template, software, comunidade paga. Receita recorrente possível.",
  },
  {
    value: "servico",
    tag: "Serviço",
    title: "Quem entrega é a própria pessoa",
    desc: "Consultoria, terapia, design, aula, atendimento. Hora sua vira agenda.",
  },
  {
    value: "hibrido",
    tag: "Híbrido",
    title: "Mistura das duas coisas",
    desc: "Vende produto e atende. Junta digital com físico. A Pólia One combina os dois.",
  },
];

function Step2({
  value,
  onSelect,
  onNext,
}: {
  value: BusinessType | null;
  onSelect: (v: BusinessType) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 pt-6">
      <LogoPlaceholder />
      <Manuscrito>Agora, um pouco sobre o que sua marca faz</Manuscrito>
      <Headline size={64}>Como é o que sua marca vende?</Headline>
      <Body>Isso ajusta as próximas perguntas pro seu tipo de negócio.</Body>
      <div className="grid w-full max-w-[600px] grid-cols-1 gap-4 md:grid-cols-2">
        {BIZ_TYPES.map((o) => (
          <ChoiceCard
            key={o.value}
            selected={value === o.value}
            onClick={() => onSelect(o.value)}
            tag={o.tag}
            title={o.title}
            desc={o.desc}
          />
        ))}
      </div>
      <PrimaryCTA onClick={onNext} disabled={!value}>
        Continuar →
      </PrimaryCTA>
      {!value && (
        <p className="text-center italic text-[var(--ink-soft)]">escolhe uma pra continuar</p>
      )}
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  tag,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-[170px] flex-col gap-3 rounded-2xl border p-6 text-left transition-[border-color,background-color] duration-150 ${
        selected
          ? "border-[var(--secondary)] bg-[var(--secondary-light)]"
          : "border-[var(--line)] bg-white [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--secondary)]"
      }`}
    >
      <span className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {tag}
      </span>
      <span className="text-[var(--ink)]" style={{ fontSize: 22, lineHeight: "28px" }}>
        {title}
      </span>
      <span className="text-[var(--ink-soft)]" style={{ fontSize: 12, lineHeight: "17px" }}>
        {desc}
      </span>
    </button>
  );
}

/* ---------------- STEP 3 ---------------- */
const STAGES: { value: BusinessStage; tag: string; title: string; desc: string }[] = [
  {
    value: "ideia",
    tag: "Só uma ideia",
    title: "Tô no ponto zero",
    desc: "A ideia tá na cabeça. Ainda não vendi nada, não tenho nome, nada. A Pólia One constrói tudo desde o começo.",
  },
  {
    value: "comecei",
    tag: "Já comecei",
    title: "Tô testando, mas tá solto",
    desc: "Já vendi pra alguém, já tem alguma coisa rodando, mas falta direção. A Pólia One organiza o que existe.",
  },
  {
    value: "ja_vendo",
    tag: "Já vendo",
    title: "Quero profissionalizar",
    desc: "Negócio rodando, vendas acontecendo, mas falta sistema. A Pólia One te ajuda a sair do improviso.",
  },
];

function Step3({
  value,
  onSelect,
  onNext,
}: {
  value: BusinessStage | null;
  onSelect: (v: BusinessStage) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 pt-6">
      <LogoPlaceholder />
      <Manuscrito>Em que momento sua marca está?</Manuscrito>
      <Headline size={64}>Sem pose, só o momento real</Headline>
      <Body>O Planejamento parte de onde a marca está hoje.</Body>
      <div className="grid w-full max-w-[820px] grid-cols-1 gap-4 md:grid-cols-3">
        {STAGES.map((o) => (
          <ChoiceCard
            key={o.value}
            selected={value === o.value}
            onClick={() => onSelect(o.value)}
            tag={o.tag}
            title={o.title}
            desc={o.desc}
          />
        ))}
      </div>
      <PrimaryCTA onClick={onNext} disabled={!value}>
        Continuar →
      </PrimaryCTA>
      {!value && (
        <p className="text-center italic text-[var(--ink-soft)]">escolhe um pra continuar</p>
      )}
    </div>
  );
}

/* ---------------- STEP 4 ---------------- */
const STEP4: Record<
  BusinessType,
  {
    c1: { label: string; ph: string };
    c2?: { label: string; ph: string };
    toggle: { label: string; opcoes: { v: string; label: string }[] };
    hibrido?: boolean;
  }
> = {
  produto_fisico: {
    c1: {
      label: "Como se chama o que é vendido?",
      ph: "ex: sabonetes artesanais, roupas infantis",
    },
    c2: {
      label: "O que vai junto com o produto? O que a pessoa recebe?",
      ph: "ex: embalagem, nota, bilhetinho",
    },
    toggle: {
      label: "Produção própria, revenda ou os dois?",
      opcoes: [
        { v: "produzo", label: "Produzo" },
        { v: "revendo", label: "Revendo" },
        { v: "ambos", label: "Os dois" },
      ],
    },
  },
  produto_digital: {
    c1: {
      label: "Qual é o seu produto digital?",
      ph: "ex: curso de aquarela, template de contrato",
    },
    c2: {
      label: "O que a pessoa recebe quando compra?",
      ph: "ex: acesso a vídeos por 1 ano, PDF para download",
    },
    toggle: {
      label: "Tem recorrência?",
      opcoes: [
        { v: "unico", label: "Pagamento único" },
        { v: "assinatura", label: "Assinatura / Mensalidade" },
      ],
    },
  },
  servico: {
    c1: { label: "Qual é o seu serviço?", ph: "ex: design de logos, consultoria financeira" },
    c2: {
      label: "O que é entregue ao final de cada trabalho?",
      ph: "ex: arquivos editáveis, relatório, sessão gravada",
    },
    toggle: {
      label: "Como funciona a cobrança?",
      opcoes: [
        { v: "hora", label: "Por hora" },
        { v: "projeto", label: "Por projeto" },
        { v: "mensal", label: "Pacote mensal" },
      ],
    },
  },
  hibrido: {
    c1: { label: "O que é vendido?", ph: "ex: curso + mentoria, produto físico + consulta" },
    toggle: {
      label: "Das duas frentes, qual é a principal agora?",
      opcoes: [
        { v: "produto", label: "O produto" },
        { v: "servico", label: "O serviço" },
        { v: "ambas", label: "As duas igualmente" },
      ],
    },
    hibrido: true,
  },
};

function Step4({
  state,
  setState,
  jaSalvo,
  onSuccess,
}: {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  /** Voltou da tela final pra corrigir: salva de novo, mas não conta de novo. */
  jaSalvo: boolean;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tipo = state.business_type;
  const cfg = tipo ? STEP4[tipo] : null;

  function buildDescricao() {
    if (!tipo) return null;
    if (tipo === "hibrido") {
      return {
        tipo,
        o_que_vende: state.c1.trim() || null,
        principal: state.toggle || null,
        frente_produto: state.hp.trim() || null,
        frente_servico: state.hs.trim() || null,
      };
    }
    return {
      tipo,
      o_que_vende: state.c1.trim() || null,
      detalhe: state.c2.trim() || null,
      modo: state.toggle || null,
    };
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error("Sessão expirou");
      const fullName =
        (sess.session?.user.user_metadata?.full_name as string | undefined)?.trim() || null;

      const { error: upErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          business_type: state.business_type,
          business_stage: state.business_stage,
          business_name: state.business_name.trim() || null,
          display_name: fullName,
          descricao_produto: buildDescricao(),
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      );
      if (upErr) throw upErr;
      if (!jaSalvo) {
        track("onboarding_concluido", { tipo_negocio: state.business_type });
        void registrar("onboarding_completed", {
          feature: "onboarding",
          propriedades: { tipo_negocio: state.business_type },
        });
        if (state.business_name.trim()) {
          void registrar("business_created", { feature: "onboarding" });
        }
      }
      onSuccess();
    } catch (e) {
      track("onboarding_falhou", { motivo: (e as Error).message || "erro_desconhecido" });
      // O texto cru do banco não vai pra tela (vem em inglês, com nome de
      // coluna); ele já foi pro analytics na linha de cima.
      setError("A Pólia One não conseguiu salvar. Tenta de novo, as respostas continuam aqui.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 pt-6">
      <LogoPlaceholder />
      <Manuscrito>Agora vem a parte mais sua</Manuscrito>
      <Headline size={56}>O que sua marca vende e o que entrega?</Headline>
      <p className="text-center text-[14px] text-[var(--muted)]">
        Pode ser breve. Dá pra ajustar depois.
      </p>

      <div className="flex w-full max-w-[480px] flex-col gap-5">
        <Field
          label="Nome do seu negócio"
          value={state.business_name}
          onChange={(v) => setState((s) => ({ ...s, business_name: v.slice(0, 60) }))}
          placeholder="Mesmo que provisório, coloca o que vier."
        />

        {cfg && (
          <>
            <Field
              label={cfg.c1.label}
              value={state.c1}
              onChange={(v) => setState((s) => ({ ...s, c1: v.slice(0, 120) }))}
              placeholder={cfg.c1.ph}
            />
            {cfg.c2 && (
              <Field
                label={cfg.c2.label}
                value={state.c2}
                onChange={(v) => setState((s) => ({ ...s, c2: v.slice(0, 200) }))}
                placeholder={cfg.c2.ph}
                multiline
              />
            )}
            <Toggle
              label={cfg.toggle.label}
              value={state.toggle}
              opcoes={cfg.toggle.opcoes}
              onChange={(v) => setState((s) => ({ ...s, toggle: v }))}
            />
            {cfg.hibrido && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="O que recebe · Produto"
                  value={state.hp}
                  onChange={(v) => setState((s) => ({ ...s, hp: v.slice(0, 120) }))}
                  placeholder="ex: o produto em si, garantia"
                />
                <Field
                  label="O que recebe · Serviço"
                  value={state.hs}
                  onChange={(v) => setState((s) => ({ ...s, hs: v.slice(0, 120) }))}
                  placeholder="ex: as sessões, o acompanhamento"
                />
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-center text-[14px] text-[var(--danger)]">
          {error}
        </p>
      )}

      <PrimaryCTA onClick={handleSubmit} disabled={saving}>
        {saving ? "Salvando..." : "Continuar →"}
      </PrimaryCTA>
    </div>
  );
}

const CAMPO_CLS =
  "rounded-lg border border-[var(--line)] bg-white px-4 text-[16px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus:border-[var(--secondary-text)]";

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
        {required && <span className="ml-1 text-[var(--danger)]">*</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`${CAMPO_CLS} resize-none py-3`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${CAMPO_CLS} h-14`}
        />
      )}
    </label>
  );
}

function Toggle({
  label,
  value,
  opcoes,
  onChange,
}: {
  label: string;
  value: string;
  opcoes: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const on = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(on ? "" : o.v)}
              aria-pressed={on}
              className={`${BTN_MIUDO} ${on ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- STEP 5 ---------------- */
// O que a Calculadora faz, no idioma de cada tipo de negócio.
const CALCULADORA_DESC: Record<BusinessType, string> = {
  produto_fisico:
    "O custo do material, as taxas da maquininha ou do marketplace e quanto precisa sobrar viram um preço sugerido.",
  produto_digital:
    "O custo da plataforma, as taxas de venda e quanto precisa sobrar viram um preço sugerido.",
  servico:
    "As horas de trabalho, os custos e quanto precisa sobrar viram o valor a cobrar por hora.",
  hibrido:
    "Funciona pro produto e pro serviço: custo, taxas e quanto precisa sobrar viram um preço sugerido.",
};

function StepFinal({
  tipo,
  onFinish,
  onPlanejamento,
}: {
  tipo: BusinessType | null;
  onFinish: () => void;
  onPlanejamento: () => void;
}) {
  const desc = tipo ? CALCULADORA_DESC[tipo] : CALCULADORA_DESC.produto_fisico;
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-5 pt-6">
      <LogoPlaceholder />
      <Manuscrito>Pronto, tá tudo no lugar</Manuscrito>
      <Headline size={56}>Agora, o primeiro preço</Headline>

      <div className="w-full rounded-2xl border border-[var(--line)] bg-white p-6">
        <p className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Calculadora de preço
        </p>
        <p className="mt-3 text-[24px] text-[var(--ink)]">Quanto cobrar e quanto sobra</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">{desc}</p>
      </div>

      <p className="text-center text-[14px] text-[var(--muted)]">
        Não depende do Planejamento: um produto já mostra o preço.
      </p>

      <button type="button" onClick={onFinish} className={`${BTN_PRIMARIO} w-full`}>
        Quero calcular meu primeiro preço →
      </button>
      <button
        type="button"
        onClick={onPlanejamento}
        className="inline-flex min-h-11 items-center rounded-lg px-2 text-[14px] text-[var(--secondary-text)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
      >
        Prefiro começar pelo Planejamento
      </button>
    </div>
  );
}
