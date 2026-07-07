import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding · Pólia" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
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

function OnboardingPage() {
  const [step, setStep] = useState(1);
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

  return (
    <div className="polia-v3 min-h-screen w-full bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full px-5 pb-20 pt-10">
        {step > 1 && <StepIndicator step={step} />}
        <div className="mx-auto w-full max-w-[900px]">
          {step === 1 && <Step1 onNext={() => setStep(2)} />}
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
          {step === 4 && <Step4 state={state} setState={setState} onSuccess={() => setStep(5)} />}
          {step === 5 && (
            <Step5 tipo={state.business_type} onFinish={() => navigate({ to: "/assinar" })} />
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <p className="text-center text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
      Passo {step} de 5
    </p>
  );
}

function LogoPlaceholder() {
  return <p className="text-center font-fraunces text-[27px] text-[var(--ink)]">Pólia</p>;
}

function Caveat({ children }: { children: React.ReactNode }) {
  return <p className="text-center italic text-[var(--ink-soft)]">{children}</p>;
}

function Headline({ children, size = 64 }: { children: React.ReactNode; size?: number }) {
  return (
    <h1
      className="text-center font-fraunces text-[var(--ink)]"
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mx-auto h-[52px] w-[270px] rounded-xl bg-[var(--secondary)] px-6 font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/* ---------------- STEP 1 ---------------- */
function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-10 pt-10">
      <LogoPlaceholder />
      <div className="flex flex-col items-center gap-5">
        <Caveat>Ei. Finalmente você chegou.</Caveat>
        <Headline size={76}>Oi. Eu sou a Pólia.</Headline>
      </div>
      <div className="flex flex-col gap-1">
        <Body>Vou te guiar do primeiro passo até sua primeira ferramenta pronta.</Body>
        <Body>Sem curso, sem teoria solta. Só direção.</Body>
      </div>
      <PrimaryCTA onClick={onNext}>Começar →</PrimaryCTA>
      <p className="text-center text-[14px] text-[var(--muted)]">Leva 3 minutinhos.</p>
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
    title: "Você é quem entrega",
    desc: "Consultoria, terapia, design, aula, atendimento. Hora sua vira agenda.",
  },
  {
    value: "hibrido",
    tag: "Híbrido",
    title: "Mistura das duas coisas",
    desc: "Vende produto e atende. Junta digital com físico. A Pólia combina os dois.",
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
    <div className="flex flex-col items-center gap-7 pt-12">
      <LogoPlaceholder />
      <Caveat>Me conta um pouquinho do que você faz.</Caveat>
      <Headline size={64}>Como é o que você vende?</Headline>
      <Body>Isso me ajuda a montar seu painel já do seu jeito.</Body>
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
      className={`flex min-h-[170px] flex-col gap-[10px] rounded-[14px] border p-[22px] text-left transition-all ${
        selected
          ? "border-[var(--secondary)] bg-[var(--secondary-light)]"
          : "border-[var(--line)] bg-white"
      }`}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
        {tag}
      </span>
      <span
        className="font-fraunces text-[var(--ink)]"
        style={{ fontSize: 22, lineHeight: "28px" }}
      >
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
    desc: "A ideia tá na cabeça. Ainda não vendi nada, não tenho nome, nada. A Pólia constrói tudo com você do começo.",
  },
  {
    value: "comecei",
    tag: "Já comecei",
    title: "Tô testando, mas tá solto",
    desc: "Já vendi pra alguém, já tem alguma coisa rodando, mas falta direção. A Pólia organiza o que existe.",
  },
  {
    value: "ja_vendo",
    tag: "Já vendo",
    title: "Quero profissionalizar",
    desc: "Negócio rodando, vendas acontecendo, mas falta sistema. A Pólia te ajuda a sair do improviso.",
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
    <div className="flex flex-col items-center gap-7 pt-12">
      <LogoPlaceholder />
      <Caveat>Em que momento você tá?</Caveat>
      <Headline size={64}>Conta a real pra mim.</Headline>
      <Body>Sem julgamento. A gente começa de onde você está.</Body>
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
      label: "Como se chama o que você vende?",
      ph: "ex: sabonetes artesanais, roupas infantis",
    },
    c2: {
      label: "O que vai junto com o produto? O que a pessoa recebe?",
      ph: "ex: embalagem, nota, bilhetinho",
    },
    toggle: {
      label: "Você produz, revende ou os dois?",
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
      label: "O que você entrega ao final de cada trabalho?",
      ph: "ex: arquivos editáveis, relatório, sessão gravada",
    },
    toggle: {
      label: "Como você cobra?",
      opcoes: [
        { v: "hora", label: "Por hora" },
        { v: "projeto", label: "Por projeto" },
        { v: "mensal", label: "Pacote mensal" },
      ],
    },
  },
  hibrido: {
    c1: { label: "O que você vende?", ph: "ex: curso + mentoria, produto físico + consulta" },
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
  onSuccess,
}: {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
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
      onSuccess();
    } catch (e) {
      setError((e as Error).message || "Algo deu errado. Tenta de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-7 pt-12">
      <LogoPlaceholder />
      <Caveat>Agora a parte mais sua.</Caveat>
      <Headline size={56}>O que você vende e o que entrega?</Headline>
      <p className="text-center text-[14px] text-[var(--muted)]">
        Pode ser breve. Você ajusta depois.
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

      {error && <p className="text-center text-[14px] text-[var(--danger)]">{error}</p>}

      <PrimaryCTA onClick={handleSubmit} disabled={saving}>
        {saving ? "Salvando..." : "Continuar →"}
      </PrimaryCTA>
    </div>
  );
}

const CAMPO_CLS =
  "rounded-lg border border-[var(--line)] bg-white px-4 text-[16px] text-[var(--ink)] outline-none transition-all placeholder:text-[var(--muted)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_1px_var(--secondary)]";

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
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
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
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
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
              className={`rounded-full border px-4 py-2 text-[14px] transition-colors ${
                on
                  ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--secondary)]"
              }`}
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
const ETAPA1_DESC: Record<BusinessType, string> = {
  produto_fisico: "Quem você é, o que você produz e de onde vem o que você vende.",
  produto_digital: "Quem você é, o que você ensina e qual problema você resolve.",
  servico: "Quem você é, qual problema você resolve e como você trabalha.",
  hibrido: "Quem você é e como as duas frentes do seu negócio se complementam.",
};

function Step5({ tipo, onFinish }: { tipo: BusinessType | null; onFinish: () => void }) {
  const desc = tipo ? ETAPA1_DESC[tipo] : ETAPA1_DESC.produto_fisico;
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-7 pt-12">
      <LogoPlaceholder />
      <Caveat>Pronto. Tá tudo no lugar.</Caveat>
      <Headline size={56}>Seu planejamento começa agora.</Headline>

      <div className="w-full rounded-2xl border border-[var(--line)] bg-white p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          Módulo 1 de 6
        </p>
        <p className="mt-3 font-fraunces text-[24px] text-[var(--ink)]">Razão de existir</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">{desc}</p>
        <p className="mt-4 text-[13px] text-[var(--secondary-text)]">→ Abre agora</p>
      </div>

      <p className="text-center italic text-[var(--ink-soft)]">
        A Pólia não acaba. Ela só fica mais sua.
      </p>
      <p className="text-center text-[14px] text-[var(--muted)]">
        cada vez que você volta, encontra mais de você aqui
      </p>

      <button
        type="button"
        onClick={onFinish}
        className="h-[52px] w-full rounded-xl bg-[var(--secondary)] font-medium text-[var(--secondary-ink)] hover:opacity-90"
      >
        Começar meu planejamento →
      </button>
    </div>
  );
}
