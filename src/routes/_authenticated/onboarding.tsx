import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CosmicBackground } from "@/components/cosmic/CosmicBackground";
import { CosmicButton } from "@/components/cosmic/CosmicButton";
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
    if (data?.onboarding_completed) throw redirect({ to: "/painel" });
  },
  component: OnboardingPage,
});

type BusinessType = "produto_fisico" | "produto_digital" | "servico" | "hibrido";
type BusinessStage = "ideia" | "comecei" | "ja_vendo";

interface OnboardingState {
  business_type: BusinessType | null;
  business_stage: BusinessStage | null;
  display_name: string;
  business_name: string;
}

function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({
    business_type: null,
    business_stage: null,
    display_name: "",
    business_name: "",
  });
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 min-h-screen w-full px-5 pb-20 pt-10">
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
          {step === 4 && (
            <Step4
              state={state}
              setState={setState}
              onSuccess={() => setStep(5)}
            />
          )}
          {step === 5 && (
            <Step5 onFinish={() => navigate({ to: "/painel" })} />
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <p
      className="text-center font-sans font-semibold uppercase text-[#C8A96E]/90"
      style={{ fontSize: 11, letterSpacing: 2.5 }}
    >
      Passo {step} de 5
    </p>
  );
}

function LogoPlaceholder({ size = 180 }: { size?: number }) {
  return (
    <div
      className="mx-auto flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-[rgba(36,36,66,0.4)] p-4 text-center"
      style={{
        width: size === 180 ? 220 : size,
        height: size,
        borderColor: "rgba(200,169,110,0.5)",
        borderWidth: 1.5,
      }}
    >
      <span className="font-sans font-semibold uppercase text-[#C8A96E]" style={{ fontSize: 10, letterSpacing: 1.5 }}>
        Placeholder · Logo
      </span>
      <span className="font-sans text-[#D8D2CC]" style={{ fontSize: 10 }}>
        Lockup L2 Vertical · 180×180
      </span>
      <span className="font-sans text-[#D8D2CC]/70" style={{ fontSize: 9 }}>
        SVG · upload no Lovable
      </span>
    </div>
  );
}

function Caveat({ children, size = 28 }: { children: React.ReactNode; size?: number }) {
  return (
    <p className="text-center caveat-decorativo text-[#E89770]" style={{ fontSize: size, lineHeight: 1.15 }}>
      {children}
    </p>
  );
}

function Headline({ children, size = 64 }: { children: React.ReactNode; size?: number }) {
  return (
    <h1
      className="text-center font-serif text-[#FDF8F5]"
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
      className="mx-auto text-center font-sans text-[#D8D2CC]"
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
  loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="relative mx-auto" style={{ width: 270 }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-[rgba(201,107,62,0.3)] blur-[2px]"
        style={{ width: 300, height: 68 }}
      />
      <CosmicButton onClick={onClick} disabled={disabled} loading={loading} variant="primary">
        {children}
      </CosmicButton>
    </div>
  );
}

/* ---------------- STEP 1 ---------------- */
function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 pt-4">
      <LogoPlaceholder />
      <div className="mt-2 flex flex-col items-center gap-5">
        <Caveat size={32}>Ei. Finalmente você chegou.</Caveat>
        <Headline size={76}>Oi. Eu sou a Pólia.</Headline>
      </div>
      <div className="flex flex-col gap-1">
        <Body>Vou te guiar do primeiro passo até seu primeiro entregável.</Body>
        <Body>Sem curso, sem teoria solta. Só direção.</Body>
      </div>
      <PrimaryCTA onClick={onNext}>Bora começar  →</PrimaryCTA>
      <p className="text-center font-sans text-[14px] text-[#D8D2CC]/65">Leva 3 minutinhos.</p>
      <FoxPlaceholder />
    </div>
  );
}

function FoxPlaceholder() {
  return (
    <div
      className="mx-auto flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed bg-[rgba(36,36,66,0.5)] p-4 text-center"
      style={{ width: 260, height: 220, borderColor: "rgba(232,151,112,0.6)", borderWidth: 1.5 }}
    >
      <div className="rounded-full bg-[rgba(36,36,66,0.6)]" style={{ width: 54, height: 54 }} />
      <span className="font-sans font-semibold uppercase text-[#E89770]" style={{ fontSize: 10, letterSpacing: 1.5 }}>
        Placeholder · Raposa
      </span>
      <span className="caveat-decorativo text-[#E89770]" style={{ fontSize: 22 }}>
        Estado: Orientando
      </span>
      <span className="font-sans text-[#D8D2CC]" style={{ fontSize: 10 }}>
        PNG transparente · 220×260
      </span>
    </div>
  );
}

/* ---------------- STEP 2 ---------------- */
const BIZ_TYPES: { value: BusinessType; tag: string; title: string; desc: string }[] = [
  { value: "produto_fisico", tag: "Produto Físico", title: "Algo que vai pelo correio", desc: "Roupa, comida, joia, cosmético, artesanato. Tem estoque, tem envio." },
  { value: "produto_digital", tag: "Produto Digital", title: "Algo que se baixa ou se acessa", desc: "Curso, ebook, template, software, comunidade paga. Receita recorrente possível." },
  { value: "servico", tag: "Serviço", title: "Você é quem entrega", desc: "Consultoria, terapia, design, aula, atendimento. Hora sua vira agenda." },
  { value: "hibrido", tag: "Híbrido", title: "Mistura das duas coisas", desc: "Vende produto e atende. Junta digital com físico. A Pólia combina os dois." },
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
      <PrimaryCTA onClick={onNext} disabled={!value}>Continuar  →</PrimaryCTA>
      {!value && (
        <p className="text-center caveat-decorativo text-[rgba(232,151,112,0.7)]" style={{ fontSize: 18 }}>
          escolhe uma pra continuar
        </p>
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
      className="flex flex-col gap-[10px] rounded-[14px] p-[22px] text-left transition-all"
      style={{
        background: selected ? "rgba(201,107,62,0.15)" : "rgba(36,36,66,0.55)",
        border: `1.5px solid ${selected ? "#C96B3E" : "rgba(232,151,112,0.4)"}`,
        boxShadow: selected ? "0 0 20px rgba(201,107,62,0.2)" : "none",
        minHeight: 170,
      }}
    >
      <span className="font-sans font-semibold uppercase text-[#C8A96E]" style={{ fontSize: 10, letterSpacing: 1.8 }}>
        {tag}
      </span>
      <span className="font-serif text-[#FDF8F5]" style={{ fontSize: 22, lineHeight: "28px" }}>
        {title}
      </span>
      <span className="font-sans text-[#D8D2CC]" style={{ fontSize: 12, lineHeight: "17px" }}>
        {desc}
      </span>
    </button>
  );
}

/* ---------------- STEP 3 ---------------- */
const STAGES: { value: BusinessStage; tag: string; title: string; desc: string }[] = [
  { value: "ideia", tag: "Só uma ideia", title: "Tô no ponto zero", desc: "A ideia tá na cabeça. Ainda não vendi nada, não tenho nome, nada. A Pólia constrói tudo com você do começo." },
  { value: "comecei", tag: "Já comecei", title: "Tô testando, mas tá solto", desc: "Já vendi pra alguém, já tem alguma coisa rodando, mas falta direção. A Pólia organiza o que existe." },
  { value: "ja_vendo", tag: "Já vendo", title: "Quero profissionalizar", desc: "Negócio rodando, vendas acontecendo, mas falta sistema. A Pólia te ajuda a sair do improviso." },
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
      <PrimaryCTA onClick={onNext} disabled={!value}>Continuar  →</PrimaryCTA>
      {!value && (
        <p className="text-center caveat-decorativo text-[rgba(232,151,112,0.7)]" style={{ fontSize: 18 }}>
          escolhe um pra continuar
        </p>
      )}
    </div>
  );
}

/* ---------------- STEP 4 ---------------- */
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

  const displayTrim = state.display_name.trim();
  const valid = displayTrim.length >= 2 && displayTrim.length <= 40;

  async function handleSubmit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error("Sessão expirou");

      const { error: upErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            business_type: state.business_type,
            business_stage: state.business_stage,
            display_name: displayTrim,
            business_name: state.business_name.trim() || null,
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          },
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
      <Caveat>A gente tá quase lá.</Caveat>
      <Headline size={60}>Como você quer ser chamada?</Headline>
      <Body max={800}>Vou te chamar pelo nome em todo lugar. Coloca o que eu escutar e te reconhecer.</Body>

      <div className="flex w-full max-w-[440px] flex-col gap-5">
        <Field
          label="Seu nome ou apelido"
          value={state.display_name}
          onChange={(v) => setState((s) => ({ ...s, display_name: v.slice(0, 40) }))}
          placeholder="Como te chamo aqui? (ex: Aimer, Ai, Lú...)"
          required
        />
        <Field
          label="Nome do seu negócio (mesmo provisório)"
          value={state.business_name}
          onChange={(v) => setState((s) => ({ ...s, business_name: v.slice(0, 60) }))}
          placeholder="Ainda tá pensando? Tudo bem. Coloca o que vier."
        />
      </div>

      <p className="text-center caveat-decorativo text-[rgba(232,151,112,0.7)]" style={{ fontSize: 16 }}>
        depois você pode trocar nos ajustes do perfil
      </p>

      {error && (
        <p className="text-center font-sans" style={{ fontSize: 14, color: "#E53E3E" }}>
          {error}
        </p>
      )}

      <PrimaryCTA onClick={handleSubmit} disabled={!valid || saving} loading={saving}>
        {saving ? "Salvando..." : "Continuar  →"}
      </PrimaryCTA>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-sans font-semibold uppercase text-[#C8A96E]" style={{ fontSize: 10, letterSpacing: 1.8 }}>
        {label}
        {required && <span className="ml-1 text-[#E89770]">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl px-[18px] font-sans text-[#FDF8F5] outline-none transition-all placeholder:text-[rgba(216,210,204,0.55)] focus:border-[#C96B3E]"
        style={{
          height: 56,
          background: "rgba(36,36,66,0.55)",
          border: "1.2px solid rgba(232,151,112,0.45)",
          fontSize: 16,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#C96B3E";
          e.currentTarget.style.boxShadow = "0 0 12px rgba(201,107,62,0.25)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(232,151,112,0.45)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </label>
  );
}

/* ---------------- STEP 5 ---------------- */
const STARS = [
  "Descoberta", "Branding", "Posicionamento", "Produto", "Vitrine", "Estoque",
  "Vendas", "Atendimento", "Marketing", "Métricas", "Evolução",
];

function Star({ active }: { active: boolean }) {
  const size = active ? 20 : 14;
  const fill = active ? "#C96B3E" : "rgba(216,210,204,0.5)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
    </svg>
  );
}

function Step5({ onFinish }: { onFinish: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 pt-12">
      <LogoPlaceholder />
      <Caveat size={30}>Pronto. Tá tudo no lugar.</Caveat>
      <Headline size={72}>
        Sua primeira estrela vai
        <br />
        acender agora.
      </Headline>

      <div className="w-full overflow-x-auto py-6">
        <div className="mx-auto flex min-w-max items-start justify-center gap-6 px-4">
          {STARS.map((label, i) => {
            const active = i === 0;
            return (
              <div key={label} className="flex w-[80px] flex-col items-center gap-2">
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    width: active ? 44 : 24,
                    height: active ? 44 : 24,
                    opacity: active ? (mounted ? 1 : 0) : 1,
                    transform: active ? `scale(${mounted ? 1 : 0.5})` : "none",
                    transition: "opacity 800ms ease-out, transform 600ms ease-out",
                  }}
                >
                  {active && (
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "rgba(201,107,62,0.3)",
                        animation: "polia-pulse 2s ease-in-out infinite",
                      }}
                    />
                  )}
                  <div className="relative"><Star active={active} /></div>
                </div>
                <span
                  className="text-center font-sans"
                  style={{
                    fontSize: 9,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#FDF8F5" : "rgba(216,210,204,0.55)",
                  }}
                >
                  {label}
                </span>
                {active && (
                  <span className="caveat-decorativo text-[#E89770]" style={{ fontSize: 14 }}>
                    acendendo agora
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center font-serif text-[#C96B3E]" style={{ fontSize: 22 }}>
        A Pólia não acaba. Ela só fica mais sua.
      </p>
      <p className="text-center caveat-decorativo text-[rgba(232,151,112,0.8)]" style={{ fontSize: 18 }}>
        cada vez que você volta, encontra mais de você aqui
      </p>

      <PrimaryCTA onClick={onFinish}>Começar minha jornada  →</PrimaryCTA>

      <style>{`
        @keyframes polia-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

