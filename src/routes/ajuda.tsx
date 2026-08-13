import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PlayCircle,
  User,
  KanbanSquare,
  Users,
  Wallet,
  CreditCard,
  Mail,
  Clock,
  HelpCircle,
} from "lucide-react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { enviarContato } from "@/lib/contato.functions";
import { track } from "@/lib/analytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FieldError } from "@/components/ui/FieldError";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { gatePublico } from "@/lib/site-gate";

export const Route = createFileRoute("/ajuda")({
  beforeLoad: gatePublico,
  head: () => ({
    meta: [
      { title: "Ajuda · Pólia" },
      {
        name: "description",
        content:
          "Central de ajuda da Pólia. Respostas curtas e diretas, e um canal pra falar com a gente.",
      },
      { property: "og:title", content: "Ajuda · Pólia" },
      { property: "og:description", content: "Como a gente pode ajudar?" },
    ],
  }),
  component: AjudaPage,
});

const CATEGORIAS = [
  {
    icon: PlayCircle,
    titulo: "Primeiros passos",
    itens: [
      {
        pergunta: "Por onde começar no Planejamento",
        resposta:
          "Pelo módulo 1. Os seis módulos abrem em ordem, um de cada vez, porque cada resposta usa a anterior. No fim dos seis, o preço, a meta e o rumo do negócio já estão decididos.",
      },
      {
        pergunta: "O que fazer no primeiro dia",
        resposta:
          "Comece o Planejamento. É a base de tudo: enquanto ele não está pronto, Produtos, Financeiro e Painel ficam sem o preço e a meta que dependem dele.",
      },
      {
        pergunta: "Usando no celular",
        resposta:
          "A Pólia funciona direto no navegador do celular, sem precisar instalar nada. A tela se ajusta ao tamanho, e o que começa no computador continua de onde parou no celular.",
      },
    ],
  },
  {
    icon: User,
    titulo: "Identidade",
    itens: [
      {
        pergunta: "Definir quem é a minha marca",
        resposta:
          "É o módulo 1 do Planejamento: quem a marca atende, o que ela entrega e o que a diferencia. As respostas ficam salvas e alimentam o resto do sistema.",
      },
      {
        pergunta: "Mudar o que vendo depois",
        resposta:
          "Pode editar o Planejamento quando quiser, direto na tela dele. A mudança se reflete nos módulos que dependem dessa resposta, sem precisar refazer nada do zero.",
      },
      {
        pergunta: "Por que a Pólia me pergunta isso",
        resposta:
          "Porque o preço, a meta e os módulos seguintes usam essas respostas pra funcionar. Não é formulário de cadastro, é a decisão que sustenta o resto do sistema.",
      },
    ],
  },
  {
    icon: KanbanSquare,
    titulo: "Planner e rotina",
    itens: [
      {
        pergunta: "Criar um quadro no Planner",
        resposta:
          "No Planner, clique em novo quadro e dê um nome ao projeto. Cada quadro tem colunas que dá pra renomear e reordenar, tipo um kanban.",
      },
      {
        pergunta: "Organizar as tarefas da semana",
        resposta:
          "Arraste os cartões entre as colunas conforme o andamento. O quadro fica só seu, sem prazo travado nem cobrança se uma tarefa demorar mais que o previsto.",
      },
      {
        pergunta: "Ligar uma tarefa à meta do mês",
        resposta:
          "Ao criar o cartão, dá pra vincular ele a uma meta já definida no Planejamento. Assim o que sai no dia a dia aponta pro mesmo número decidido lá.",
      },
    ],
  },
  {
    icon: Users,
    titulo: "Clientes",
    itens: [
      {
        pergunta: "Adicionar um cliente",
        resposta:
          "No módulo Clientes, clique em novo cliente e preencha os dados de contato. Depois é só vincular os produtos ou serviços que essa pessoa comprou.",
      },
      {
        pergunta: "Acompanhar quem está chegando",
        resposta:
          "A lista de Clientes mostra todo mundo cadastrado, com o status de cada um. Dá pra ver de relance quem já comprou e quem ainda está em conversa.",
      },
      {
        pergunta: "Exportar a minha lista",
        resposta:
          "Direto no módulo Clientes tem a opção de exportar a lista completa em planilha, pra quem precisa levar esse dado pra outro lugar.",
      },
    ],
  },
  {
    icon: Wallet,
    titulo: "Números",
    itens: [
      {
        pergunta: "Registrar uma venda",
        resposta:
          "Marque a entrega no módulo Clientes: quando o produto ou serviço sai, a venda entra sozinha no Financeiro. Não precisa lançar de novo em outro lugar.",
      },
      {
        pergunta: "Entender o resumo do mês",
        resposta:
          "O Financeiro mostra entradas, saídas e o que sobrou, com uma régua que compara o mês atual com as referências que vieram do seu Planejamento.",
      },
      {
        pergunta: "De onde vêm esses valores",
        resposta:
          "Todo valor no Financeiro e no Painel nasce de uma venda registrada em Clientes ou de um preço definido em Produtos. Nada ali é estimativa solta.",
      },
    ],
  },
  {
    icon: CreditCard,
    titulo: "Conta e plano",
    itens: [
      {
        pergunta: "Trocar de e-mail ou senha",
        resposta:
          "Em Configurações, na sua conta, tem a opção de trocar e-mail e senha a qualquer momento.",
      },
      {
        pergunta: "Como cancelar",
        resposta:
          "Também em Configurações, num clique. O acesso ao plano pago continua até o fim do período já pago, e depois disso a conta volta pro plano Confere, sem apagar o Planejamento.",
      },
      {
        pergunta: "Como funciona a cobrança",
        resposta:
          "Cartão e boleto cobram todo mês ou todo ano, dependendo do ciclo escolhido. Pix só está disponível no plano anual, como pagamento único.",
      },
    ],
  },
];

const ASSUNTOS = [
  "Dúvida sobre a Pólia",
  "Acesso e conta",
  "Preço e pagamento",
  "Tenho equipe e quero gerir por aqui",
  "Imprensa ou parceria",
  "Outra coisa",
];

const schema = z.object({
  nome: z.string().trim().min(2, "Falta o seu nome.").max(120),
  assunto: z.string().min(1, "Escolhe um assunto."),
  mensagem: z.string().trim().min(10, "Conta um pouco mais.").max(2000),
});

function validarEmail(v: string): string | undefined {
  const trimmed = v.trim();
  if (!trimmed) return "Falta o seu e-mail.";
  if (trimmed.length > 255) return "E-mail inválido. Confere o @.";
  return z.string().email().safeParse(trimmed).success
    ? undefined
    : "E-mail inválido. Confere o @.";
}

type Campo = "nome" | "email" | "assunto" | "mensagem";

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Campo do formulário de contato: borda neutra vira borda de perigo no erro. */
function campoClasse(temErro: boolean): string {
  return `w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors ${
    temErro
      ? "border-[var(--danger)] focus:border-[var(--danger)]"
      : "border-[var(--line)] focus:border-[var(--secondary)]"
  }`;
}

const ROTULO = "mb-2 block text-[13px] font-semibold text-[var(--ink)]";

function AjudaPage() {
  const [faqAtiva, setFaqAtiva] = useState<{ pergunta: string; resposta: string } | null>(null);
  const [busca, setBusca] = useState("");
  const buscaNormalizada = normalizar(busca.trim());
  const categoriasFiltradas =
    buscaNormalizada.length < 2
      ? CATEGORIAS
      : CATEGORIAS.map((cat) => ({
          ...cat,
          itens: cat.itens.filter(
            (item) =>
              normalizar(item.pergunta).includes(buscaNormalizada) ||
              normalizar(item.resposta).includes(buscaNormalizada),
          ),
        })).filter((cat) => cat.itens.length > 0);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Campo, string>>>({});
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Honeypot: campo invisível fora do fluxo de teclado. Humano nunca preenche; bot que
  // preenche tudo, sim. Se vier preenchido, finge sucesso e não insere nada.
  const [hp, setHp] = useState("");
  const turnstile = useTurnstile();
  const refs = {
    nome: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    assunto: useRef<HTMLSelectElement>(null),
    mensagem: useRef<HTMLTextAreaElement>(null),
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const assuntoParam = params.get("assunto");
    if (assuntoParam === "equipe") {
      setAssunto("Tenho equipe e quero gerir por aqui");
    } else if (assuntoParam?.startsWith("assinar-")) {
      setAssunto("Preço e pagamento");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Bot preencheu o honeypot: mostra "enviado" e descarta em silêncio, sem gravar.
    if (hp) {
      setEnviado(true);
      return;
    }
    const parsed = schema.safeParse({ nome, assunto, mensagem });
    const emailErro = validarEmail(email);
    if (!parsed.success || emailErro) {
      const fieldErrors: Partial<Record<Campo, string>> = {};
      const ordemCampos: Campo[] = ["nome", "email", "assunto", "mensagem"];
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          fieldErrors[issue.path[0] as Campo] = issue.message;
        }
      }
      if (emailErro) fieldErrors.email = emailErro;
      setErrors(fieldErrors);
      const primeiroCampo = ordemCampos.find((c) => fieldErrors[c]);
      track("formulario_invalido", { pagina: "ajuda", campo: primeiroCampo });
      if (primeiroCampo) refs[primeiroCampo].current?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      // O Turnstile é validado no servidor (dentro de enviarContato). O token é
      // uso único, então aqui só checamos que existe — quem valida é o servidor.
      if (!turnstile.token) {
        toastErro("Confirma que não é um robô antes de enviar.");
        setLoading(false);
        return;
      }
      const resultado = await enviarContato({
        data: {
          nome: parsed.data.nome,
          email: email.trim(),
          assunto: parsed.data.assunto,
          mensagem: parsed.data.mensagem,
          turnstileToken: turnstile.token,
          hp,
        },
      });
      if (resultado.ok) {
        track("contato_enviado", { assunto: parsed.data.assunto });
        setEnviado(true);
      } else {
        track("contato_falhou", { motivo: "resultado_nao_ok" });
        turnstile.reset();
        toastErro("Não deu pra enviar agora. Tenta direto em oi@usepolia.com.br");
      }
    } catch {
      track("contato_falhou", { motivo: "excecao_client" });
      turnstile.reset();
      toastErro("Não deu pra enviar agora. Tenta direto em oi@usepolia.com.br");
    }
    setLoading(false);
  }

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO + BUSCA */}
        <section className="pb-[clamp(48px,6vw,72px)] pt-[clamp(48px,7vw,96px)]">
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Ajuda</Eyebrow>
              <h1 className="mt-4 max-w-[16ch] text-[clamp(2.4rem,5.4vw,4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Como a gente pode ajudar?
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[56ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                Respostas curtas e diretas, sem tutorial de dez minutos pra uma coisa de um clique.
                Se não achar o que precisa, escreve pra gente aqui embaixo.
              </p>
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("resultados-ajuda")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-8 flex max-w-[620px] flex-col gap-3 sm:flex-row"
              >
                <label htmlFor="q" className="sr-only">
                  Buscar na ajuda
                </label>
                <input
                  id="q"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar: preço, cancelar, Planner..."
                  className="w-full flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--secondary)]"
                />
                <button type="submit" className={`${BTN_PRIMARIO} whitespace-nowrap`}>
                  Buscar
                </button>
              </form>
            </Reveal>
          </div>
        </section>

        {/* CATEGORIAS */}
        <section id="resultados-ajuda" className={`scroll-mt-[88px] bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Por assunto</Eyebrow>
              <h2 className="mt-4 max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Respostas separadas por assunto.
              </h2>
            </Reveal>

            {categoriasFiltradas.length === 0 ? (
              <p className="mt-[clamp(32px,4vw,40px)] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                Nada encontrado pra “{busca.trim()}”. Escreve pra gente aqui embaixo que a gente
                responde.
              </p>
            ) : (
              <RevealGroup className="mt-[clamp(40px,5vw,48px)] grid grid-cols-1 gap-4 md:grid-cols-3">
                {categoriasFiltradas.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <RevealItem
                      key={cat.titulo}
                      className="rounded-2xl border border-[var(--line)] bg-white p-8"
                    >
                      <Icon size={22} className="text-[var(--secondary-text)]" aria-hidden="true" />
                      <h3 className="mt-4 text-[18px] font-bold tracking-[-0.01em]">
                        {cat.titulo}
                      </h3>
                      <ul className="mt-4 grid list-none gap-0 p-0">
                        {cat.itens.map((item, i) => (
                          <li
                            key={item.pergunta}
                            className={i > 0 ? "border-t border-[var(--line)]" : ""}
                          >
                            <button
                              type="button"
                              onClick={() => setFaqAtiva(item)}
                              className="flex w-full items-center justify-between gap-3 py-3 text-left text-[15px] leading-[1.5] text-[var(--ink)] no-underline transition-colors hover:text-[var(--secondary-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                            >
                              {item.pergunta}
                              <span aria-hidden="true" className="flex-none text-[var(--muted)]">
                                →
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </RevealItem>
                  );
                })}
              </RevealGroup>
            )}
          </div>
        </section>

        <Sheet open={!!faqAtiva} onOpenChange={(open) => !open && setFaqAtiva(null)}>
          <SheetContent className="polia-v3 flex flex-col gap-4 border-l border-[var(--line)] bg-white p-8">
            <SheetHeader>
              <SheetTitle className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--ink)] text-balance">
                {faqAtiva?.pergunta}
              </SheetTitle>
              <SheetDescription className="mt-3 text-[16px] leading-[1.7] text-[var(--ink-soft)]">
                {faqAtiva?.resposta}
              </SheetDescription>
            </SheetHeader>
            <SheetFooter className="mt-auto pt-6">
              <SheetClose asChild>
                <button type="button" className={`${BTN_CONTORNO} w-full sm:w-auto`}>
                  Fechar
                </button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* NÃO ACHOU */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <div className="rounded-2xl bg-[var(--secondary)] p-8 md:p-12">
                <h2 className="max-w-[20ch] text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--secondary-ink)] text-balance">
                  Não achou o que precisava?
                </h2>
                <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.65] text-[var(--secondary-ink)]">
                  Escreve pra gente no formulário aqui embaixo. Quem responde é gente de verdade, do
                  tamanho de uma pessoa só.
                </p>
                <div className="mt-8">
                  <a href="#contato" className={BTN_CONTORNO}>
                    Ir pro formulário
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* AINDA SEM CONTA: quem chega aqui em geral ainda não assinou, está
            medindo risco antes de entrar. A página terminava no formulário, sem
            caminho de volta pra conversão. */}
        <section className="pb-[clamp(48px,6vw,72px)]">
          <div className={CONTAINER}>
            <Reveal>
              <div className="rounded-2xl border border-[var(--line)] bg-white p-8 md:p-12">
                <Eyebrow>Ainda sem conta?</Eyebrow>
                <p className="mt-4 max-w-[60ch] text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                  O Confere é grátis, sem cartão, e responde a primeira pergunta de qualquer
                  negócio: dá lucro? E se um dia a resposta for cancelar, é um clique, sem multa e
                  sem conversa difícil. Está tudo ali em cima, escrito.
                </p>
                <div className="mt-8">
                  <Link
                    to="/auth/cadastro"
                    data-track="cadastro_cta_clicado"
                    data-track-props='{"contexto":"ajuda_sem_conta"}'
                    className={BTN_PRIMARIO}
                  >
                    Criar conta grátis
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CONTATO */}
        <section id="contato" className="scroll-mt-[88px] pb-[clamp(72px,9vw,128px)]">
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-2">
              {/* coluna esquerda */}
              <Reveal>
                <Eyebrow>Contato</Eyebrow>
                <h2 className="mt-4 max-w-[14ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                  Fala com a gente.
                </h2>
                <p className="mt-6 max-w-[54ch] text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                  A Pólia é do tamanho de uma pessoa só, dos dois lados. Quem responde aqui é gente
                  de verdade, não robô. Escreve que a gente lê.
                </p>

                <hr className="my-8 border-t border-[var(--line)]" />

                <div className="grid gap-6">
                  <div className="flex items-start gap-3">
                    <Mail
                      size={20}
                      className="mt-0.5 flex-none text-[var(--secondary-text)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                        E-mail direto
                      </p>
                      <p className="mt-2">
                        <a
                          href="mailto:oi@usepolia.com.br"
                          className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                        >
                          oi@usepolia.com.br
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock
                      size={20}
                      className="mt-0.5 flex-none text-[var(--secondary-text)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                        Tempo de resposta
                      </p>
                      <p className="mt-2 text-[var(--ink-soft)]">
                        A gente responde em até 24 horas, em dias úteis.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <HelpCircle
                      size={20}
                      className="mt-0.5 flex-none text-[var(--secondary-text)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                        Dúvida rápida?
                      </p>
                      <p className="mt-2 text-[var(--ink-soft)]">
                        Talvez já esteja respondida ali em cima, nas perguntas por assunto.
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* coluna direita */}
              <Reveal delay={0.1}>
                <div className="rounded-2xl border border-[var(--line)] bg-white p-8">
                  {!enviado ? (
                    <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
                      {/* Honeypot anti-spam: escondido de humanos e de leitores de tela. */}
                      <input
                        type="text"
                        name="empresa_site"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        value={hp}
                        onChange={(e) => setHp(e.target.value)}
                        className="absolute left-[-9999px] h-0 w-0 opacity-0"
                      />
                      <div>
                        <label className={ROTULO}>Seu nome</label>
                        <input
                          ref={refs.nome}
                          type="text"
                          value={nome}
                          onChange={(e) => {
                            setNome(e.target.value);
                            if (errors.nome) setErrors((er) => ({ ...er, nome: undefined }));
                          }}
                          maxLength={120}
                          placeholder="Como a gente te chama"
                          aria-invalid={!!errors.nome || undefined}
                          aria-describedby={errors.nome ? "nome-error" : undefined}
                          className={campoClasse(!!errors.nome)}
                        />
                        <FieldError id="nome-error">{errors.nome}</FieldError>
                      </div>
                      <div>
                        <label className={ROTULO}>Seu e-mail</label>
                        <input
                          ref={refs.email}
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors((er) => ({ ...er, email: undefined }));
                          }}
                          maxLength={255}
                          placeholder="voce@email.com"
                          aria-invalid={!!errors.email || undefined}
                          aria-describedby={errors.email ? "email-error" : undefined}
                          className={campoClasse(!!errors.email)}
                        />
                        <FieldError id="email-error">{errors.email}</FieldError>
                      </div>
                      <div>
                        <label className={ROTULO}>Assunto</label>
                        <select
                          ref={refs.assunto}
                          value={assunto}
                          onChange={(e) => {
                            setAssunto(e.target.value);
                            if (errors.assunto) setErrors((er) => ({ ...er, assunto: undefined }));
                          }}
                          aria-invalid={!!errors.assunto || undefined}
                          aria-describedby={errors.assunto ? "assunto-error" : undefined}
                          className={`appearance-none ${campoClasse(!!errors.assunto)}`}
                        >
                          <option value="" disabled>
                            Escolher assunto
                          </option>
                          {ASSUNTOS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                        <FieldError id="assunto-error">{errors.assunto}</FieldError>
                      </div>
                      <div>
                        <label className={ROTULO}>Mensagem</label>
                        <textarea
                          ref={refs.mensagem}
                          value={mensagem}
                          onChange={(e) => {
                            setMensagem(e.target.value);
                            if (errors.mensagem)
                              setErrors((er) => ({ ...er, mensagem: undefined }));
                          }}
                          rows={5}
                          maxLength={2000}
                          placeholder="Conta pra gente. Uma coisa de cada vez."
                          aria-invalid={!!errors.mensagem || undefined}
                          aria-describedby={errors.mensagem ? "mensagem-error" : undefined}
                          className={`resize-none ${campoClasse(!!errors.mensagem)}`}
                        />
                        <FieldError id="mensagem-error">{errors.mensagem}</FieldError>
                      </div>
                      <TurnstileWidget containerRef={turnstile.containerRef} />
                      <button
                        type="submit"
                        disabled={loading}
                        className={`${BTN_PRIMARIO} mt-1 w-full disabled:pointer-events-none disabled:opacity-50`}
                      >
                        {loading ? "Enviando…" : "Enviar"}
                      </button>
                    </form>
                  ) : (
                    <div
                      role="status"
                      aria-live="polite"
                      className="rounded-2xl bg-[var(--surface-pink)] p-8"
                    >
                      <h2 className="max-w-[20ch] text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--ink)] text-balance">
                        Recebido. A gente te responde.
                      </h2>
                      <p className="mt-3 leading-[1.65] text-[var(--ink-soft)]">
                        Chegou aqui. A gente responde em até 24 horas, em dias úteis, no seu e-mail.
                      </p>
                    </div>
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
