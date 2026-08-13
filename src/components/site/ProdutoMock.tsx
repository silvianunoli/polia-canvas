/**
 * Telas da Pólia usadas na home de marketing.
 *
 * Por que markup e não print: print desatualiza a cada deploy, pesa como imagem
 * e não acompanha mudança de token. Estes blocos usam os mesmos tokens do
 * produto, então seguem a paleta sozinhos.
 *
 * Todos mostram o mesmo negócio fictício (Ateliê da Aquarela) e o mesmo mês, com
 * números que fecham entre si: receita R$ 2.570, mês bom R$ 3.000, faltam R$ 430.
 *
 * Acessibilidade: cada bloco é UM `role="img"` com rótulo que descreve a tela. O
 * miolo é `aria-hidden` de propósito, senão o leitor de tela recita dezenas de
 * fragmentos soltos de interface falsa.
 */

/** Janela com barra de navegador. Usada quando a tela inteira é o argumento. */
function Janela({
  url,
  label,
  children,
  className = "",
}: {
  url: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`overflow-hidden rounded-[18px] border border-[var(--line)] bg-white ${className}`}
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <span className="ml-2.5 truncate rounded-full border border-[var(--line)] bg-white px-3 py-0.5 text-[11px] text-[var(--muted)]">
          {url}
        </span>
      </div>
      <div aria-hidden="true" className="p-4 md:p-5">
        {children}
      </div>
    </div>
  );
}

/** Cartão sem barra de navegador, para recortes menores da interface. */
function Cartela({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`rounded-[16px] border border-[var(--line)] bg-white p-5 ${className}`}
    >
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-accent text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
      {children}
    </p>
  );
}

function Cartao({
  children,
  className = "",
  tom = "branco",
}: {
  children: React.ReactNode;
  className?: string;
  tom?: "branco" | "pessego";
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        tom === "pessego"
          ? "border-transparent bg-[var(--surface)]"
          : "border-[var(--line)] bg-white"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────── Painel ────────────────────────────── */

const navPainel = [
  "Painel",
  "Planejamento",
  "Vendas e clientes",
  "Produtos",
  "Financeiro",
  "Planner",
  "Metas",
  "Caderno",
];

const tarefas = [
  {
    texto: "Responder orçamento da Carla",
    quando: "venceu 10/08",
    cor: "bg-[var(--danger)]",
    atrasada: true,
  },
  { texto: "Postar o kit de setembro", quando: "hoje · 14:00", cor: "bg-[var(--highlight)]" },
  { texto: "Fechar preço da caixa 12", quando: "até 15/08", cor: "bg-[var(--secondary)]" },
];

const semana = [
  { dia: "seg", altura: "h-[45%]", turquesa: false },
  { dia: "ter", altura: "h-[70%]", turquesa: true },
  { dia: "qua", altura: "h-[35%]", turquesa: false },
  { dia: "qui", altura: "h-[80%]", turquesa: true },
  { dia: "sex", altura: "h-[54%]", turquesa: false },
  { dia: "sáb", altura: "h-[24%]", turquesa: false },
];

export function MockPainel({ className }: { className?: string }) {
  return (
    <Janela
      url="app.usepolia.com.br/painel"
      label="Painel da Pólia: a frase faltam R$ 430 pro mês bom no topo e, abaixo, a receita do mês, os pedidos, os clientes, as tarefas do dia e o gráfico da semana."
      className={className}
    >
      <div className="flex flex-col gap-5 md:flex-row">
        <aside className="hidden w-[170px] flex-none border-r border-[var(--line)] pr-4 md:block">
          <p className="text-[13px] leading-tight tracking-[-0.01em] text-[var(--ink)]">
            Ateliê da Aquarela
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">feito com Pólia</p>
          <nav className="mt-4 flex flex-col gap-0.5">
            {navPainel.map((item, i) => (
              <span
                key={item}
                className={`border-l-[3px] py-1.5 pl-2.5 text-[11.5px] ${
                  i === 0
                    ? "border-[var(--secondary)] bg-[var(--bg)] font-semibold text-[var(--ink)]"
                    : "border-transparent text-[var(--ink-soft)]"
                }`}
              >
                {item}
              </span>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <p className="font-fraunces text-[12.5px] italic text-[var(--ink-soft)]">
            Boa tarde, Marina.
          </p>
          <p className="mt-1 text-[20px] leading-[1.15] tracking-[-0.01em] text-[var(--ink)] md:text-[24px]">
            Faltam R$ 430 pro mês bom.
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">E hoje tem 3 tarefas.</p>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--highlight)] px-2.5 py-1 text-[10.5px] font-semibold leading-none text-[var(--highlight-ink)]">
              Dia 34
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[10.5px] leading-none text-[var(--ink-soft)]">
              Planejamento · Módulo 4 de 6 ·{" "}
              <span className="font-semibold text-[var(--secondary-text)]">ver</span>
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[10.5px] leading-none text-[var(--ink-soft)]">
              12 dias de presença
            </span>
          </div>

          <div className="mt-4 grid grid-cols-12 gap-2.5">
            <Cartao className="col-span-12 md:col-span-5">
              <Label>Receita do mês</Label>
              <p className="mt-1 text-[22px] leading-none tracking-[-0.01em] text-[var(--ink)]">
                R$ 2.570
              </p>
              <div className="relative mt-2.5 h-1.5 rounded-full bg-[var(--line)]">
                <span className="absolute inset-y-0 left-0 w-[86%] rounded-full bg-[var(--secondary)]" />
                <span className="absolute -top-1 left-[86%] h-3.5 w-0.5 bg-[var(--ink)]" />
              </div>
              <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">
                mês bom: <span className="font-semibold text-[var(--ink)]">R$ 3.000</span>
              </p>
            </Cartao>

            <Cartao className="col-span-6 md:col-span-3">
              <Label>Pedidos</Label>
              <p className="mt-1 text-[22px] leading-none tracking-[-0.01em] text-[var(--ink)]">
                8
              </p>
              <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">2 a entregar</p>
            </Cartao>

            <Cartao tom="pessego" className="col-span-6 md:col-span-4">
              <Label>Clientes</Label>
              <p className="mt-1 text-[22px] leading-none tracking-[-0.01em] text-[var(--ink)]">
                7
              </p>
              <p className="mt-1.5 text-[10.5px] text-[var(--ink-soft)]">
                5 entregues · 2 em espera
              </p>
            </Cartao>

            <Cartao className="col-span-12 md:col-span-6">
              <Label>Suas tarefas</Label>
              <div className="mt-1.5">
                {tarefas.map((t) => (
                  <div
                    key={t.texto}
                    className="flex items-baseline gap-2 border-b border-dashed border-[var(--line)] py-1.5 text-[11.5px] last:border-b-0"
                  >
                    <span className={`h-1.5 w-1.5 flex-none rounded-full ${t.cor}`} />
                    <span className="truncate text-[var(--ink-soft)]">{t.texto}</span>
                    <span
                      className={`ml-auto flex-none text-[10px] ${
                        t.atrasada ? "text-[var(--danger)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {t.quando}
                    </span>
                  </div>
                ))}
              </div>
            </Cartao>

            <Cartao className="col-span-12 md:col-span-6">
              <Label>Semana</Label>
              <div className="mt-2.5 flex h-[74px] items-end gap-2">
                {semana.map((d) => (
                  <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-[56px] w-full items-end">
                      <span
                        className={`w-full rounded-t-[5px] ${d.altura} ${
                          d.turquesa ? "bg-[var(--secondary)]" : "bg-[var(--accent)]"
                        }`}
                      />
                    </div>
                    <span className="text-[9.5px] text-[var(--muted)]">{d.dia}</span>
                  </div>
                ))}
              </div>
            </Cartao>
          </div>
        </div>
      </div>
    </Janela>
  );
}

/** Recorte do painel usado no terceiro movimento: só a frase que abre o dia. */
export function MockFrasePainel({ className }: { className?: string }) {
  return (
    <Cartela
      label="Painel da Pólia mostrando a frase faltam R$ 430 pro mês bom, com o aviso de três tarefas para hoje."
      className={className}
    >
      <p className="text-[19px] leading-[1.2] tracking-[-0.01em] text-[var(--ink)]">
        Faltam R$ 430 pro mês bom.
      </p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">E hoje tem 3 tarefas.</p>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--highlight)] px-2.5 py-1 text-[10.5px] font-semibold leading-none text-[var(--highlight-ink)]">
          Dia 34
        </span>
        <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[10.5px] leading-none text-[var(--ink-soft)]">
          12 dias de presença
        </span>
      </div>
    </Cartela>
  );
}

/* ─────────────────────────── Planejamento ─────────────────────────── */

const modulosDoc = [
  { n: 1, nome: "Razão de existir", estado: "feito" },
  { n: 2, nome: "Quem a marca serve", estado: "feito" },
  { n: 3, nome: "O que vende", estado: "feito" },
  { n: 4, nome: "Quanto vale", estado: "atual" },
  { n: 5, nome: "Como te acharem", estado: "aberto" },
  { n: 6, nome: "Onde a marca vai", estado: "aberto" },
];

export function MockPlanejamento({ className }: { className?: string }) {
  return (
    <Janela
      url="app.usepolia.com.br/planejamento"
      label="Tela do Planejamento da Pólia: a faixa dos seis módulos no topo e, abaixo, o documento do negócio com missão, tom da marca, o cliente que a marca serve e os três valores de mês bom, mês mínimo e mês de celebrar."
      className={className}
    >
      <p className="text-[11.5px] text-[var(--muted)]">Planejamento do</p>
      <p className="mt-0.5 text-[19px] leading-tight tracking-[-0.01em] text-[var(--ink)]">
        Ateliê da Aquarela
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {modulosDoc.map((m) => (
          <span
            key={m.n}
            className={`rounded-full border px-2.5 py-1 text-[10.5px] leading-none ${
              m.estado === "feito"
                ? "border-transparent bg-[var(--secondary)] font-semibold text-[var(--secondary-ink)]"
                : m.estado === "atual"
                  ? "border-[var(--ink)] font-semibold text-[var(--ink)]"
                  : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {m.n} · {m.nome}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-12 gap-2.5">
        <Cartao className="col-span-12 md:col-span-6">
          <Label>Missão</Label>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--ink)]">
            Levar aquarela feita à mão pra casa de quem valoriza o feito com calma.
          </p>
        </Cartao>
        <Cartao tom="pessego" className="col-span-12 md:col-span-6">
          <Label>Tom da marca</Label>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--ink)]">
            Calmo, próximo, sem pressa. Fala de processo, não de promoção.
          </p>
        </Cartao>
        <div className="col-span-12 rounded-xl border border-[var(--line)] border-l-[3px] border-l-[var(--secondary)] bg-white p-3.5">
          <Label>Cliente que a marca serve</Label>
          <p className="mt-1.5 text-[12px] leading-[1.6] text-[var(--ink-soft)]">
            Mulheres de 28 a 45 anos que decoram a casa devagar, peça por peça. Compram presente com
            história. Chegam pelo Instagram e ficam pela conversa.
          </p>
        </div>
        {[
          { rotulo: "Mês bom", valor: "R$ 3.000" },
          { rotulo: "Mês mínimo", valor: "R$ 2.500" },
          { rotulo: "Mês de celebrar", valor: "R$ 8.000" },
        ].map((v) => (
          <Cartao key={v.rotulo} className="col-span-4">
            <Label>{v.rotulo}</Label>
            <p className="mt-1 text-[16px] leading-none tracking-[-0.01em] text-[var(--ink)]">
              {v.valor}
            </p>
          </Cartao>
        ))}
      </div>
    </Janela>
  );
}

/** Uma pergunta do Planejamento, com a resposta salva. */
export function MockPergunta({ className }: { className?: string }) {
  return (
    <Cartela
      label="Uma pergunta do módulo Quanto vale, do Planejamento da Pólia, com a resposta da dona do negócio escrita abaixo e o aviso de que foi salva agora."
      className={className}
    >
      <p className="font-accent text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
        <span className="mr-2 inline-block h-[3px] w-5 translate-y-[-3px] rounded-sm bg-[var(--secondary)]" />
        Módulo 4 · Quanto vale
      </p>
      <p className="mt-3 text-[16px] leading-[1.4] tracking-[-0.01em] text-[var(--ink)]">
        Qual é o mês bom do Ateliê, aquele que paga as contas e ainda deixa respiro?
      </p>
      <p className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-[12.5px] leading-[1.6] text-[var(--ink-soft)]">
        R$ 3.000. Com R$ 2.500 as contas fecham, R$ 3.000 já dá pra guardar um pouco e comprar
        material sem aperto.
      </p>
      <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]" />
        salvo agora
      </p>
    </Cartela>
  );
}

/** Os seis módulos e a ferramenta que cada um destrava. */
const modulosFerramenta = [
  { nome: "Razão de existir", ferramenta: "Marca", estado: "feito" },
  { nome: "Quem a marca serve", ferramenta: "Mercado", estado: "feito" },
  { nome: "O que vende", ferramenta: "Catálogo", estado: "feito" },
  { nome: "Quanto vale", ferramenta: "Financeiro", estado: "atual" },
  { nome: "Como te acharem", ferramenta: "Caderno", estado: "fechado" },
  { nome: "Onde a marca vai", ferramenta: "Metas", estado: "fechado" },
];

export function MockModulos({ className }: { className?: string }) {
  return (
    <Cartela
      label="Lista dos seis módulos do Planejamento da Pólia e a ferramenta que cada um destrava: Marca, Mercado, Catálogo, Financeiro, Caderno e Metas. Os três primeiros aparecem concluídos."
      className={className}
    >
      <div className="flex flex-col gap-2">
        {modulosFerramenta.map((m, i) => (
          <div
            key={m.nome}
            className={`flex items-center gap-3 rounded-[10px] border bg-white px-3 py-2.5 ${
              m.estado === "atual" ? "border-[var(--ink)]" : "border-[var(--line)]"
            } ${m.estado === "fechado" ? "opacity-50" : ""}`}
          >
            <span
              className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full border-[1.5px] text-[10px] font-semibold ${
                m.estado === "feito"
                  ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-ink)]"
                  : m.estado === "atual"
                    ? "border-[var(--ink)] text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              {m.estado === "feito" ? "✓" : i + 1}
            </span>
            <span className="text-[12.5px] font-medium text-[var(--ink)]">{m.nome}</span>
            <span className="font-accent ml-auto text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--secondary-text)]">
              {m.ferramenta}
            </span>
          </div>
        ))}
      </div>
    </Cartela>
  );
}

/* ──────────────────────── Preço, metas e rotina ──────────────────────── */

export function MockCalculadora({ className }: { className?: string }) {
  return (
    <Janela
      url="app.usepolia.com.br/produtos"
      label="Calculadora de preço da Pólia: a caixa com 12 aquarelas mini, com material, taxa da maquininha e envio somados, o preço de venda de R$ 49 e o destaque de que sobram R$ 18,90 por caixa."
      className={className}
    >
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 flex-none rounded-[10px] bg-[var(--accent)]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
            Caixa 12 aquarelas mini
          </p>
          <p className="text-[11px] text-[var(--muted)]">produto físico · catálogo</p>
        </div>
      </div>

      <div className="mt-4">
        {[
          ["Material e embalagem", "R$ 21,40"],
          ["Taxa da maquininha", "R$ 2,45"],
          ["Envio médio", "R$ 6,25"],
          ["Preço de venda", "R$ 49,00"],
        ].map(([nome, valor]) => (
          <div
            key={nome}
            className="flex items-baseline justify-between border-b border-dashed border-[var(--line)] py-2 text-[12.5px] text-[var(--ink-soft)] last:border-b-0"
          >
            <span>{nome}</span>
            <span className="font-semibold text-[var(--ink)]">{valor}</span>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-[var(--surface-pink)] px-3.5 py-3">
        <span className="font-accent text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
          Sobra de verdade
        </span>
        <span className="text-[19px] leading-none tracking-[-0.01em] text-[var(--ink)]">
          R$ 18,90 por caixa
        </span>
      </div>
    </Janela>
  );
}

const metas = [
  {
    titulo: "Faturar R$ 3.000 no mês",
    detalhe: "R$ 2.570 de R$ 3.000",
    pct: "w-[86%]",
    feita: false,
  },
  { titulo: "10 clientes novos", detalhe: "7 de 10", pct: "w-[70%]", feita: false },
  { titulo: "Guardar R$ 500", detalhe: "concluída", pct: "w-full", feita: true },
];

export function MockMetas({ className }: { className?: string }) {
  return (
    <Cartela
      label="Tela de metas da Pólia com três metas ativas: faturar R$ 3.000 no mês com R$ 2.570 alcançados, dez clientes novos com sete alcançados, e guardar R$ 500 já concluída."
      className={className}
    >
      {metas.map((m) => (
        <div
          key={m.titulo}
          className="border-b border-dashed border-[var(--line)] py-3.5 first:pt-0 last:border-b-0 last:pb-0"
        >
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="font-semibold text-[var(--ink)]">{m.titulo}</span>
            <span className="flex-none text-[11px] text-[var(--muted)]">{m.detalhe}</span>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-[var(--line)]">
            <span
              className={`block h-full rounded-full ${m.pct} ${
                m.feita ? "bg-[var(--highlight)]" : "bg-[var(--secondary)]"
              }`}
            />
          </div>
        </div>
      ))}
    </Cartela>
  );
}

const colunas: {
  titulo: string;
  cartoes: { texto: string; tag?: string; prazo?: string; pr: string; feito?: boolean }[];
}[] = [
  {
    titulo: "Hoje",
    cartoes: [
      {
        texto: "Postar o kit de setembro",
        tag: "divulgação",
        prazo: "14:00",
        pr: "bg-[var(--highlight)]",
      },
      {
        texto: "Responder orçamento da Carla",
        tag: "venda",
        prazo: "atrasada",
        pr: "bg-[var(--danger)]",
      },
    ],
  },
  {
    titulo: "Em progresso",
    cartoes: [
      { texto: "Fotografar caixa 12", tag: "catálogo", pr: "bg-[var(--highlight)]" },
      {
        texto: "Fechar preço da caixa 12",
        tag: "preço",
        prazo: "até 15/08",
        pr: "bg-[var(--muted)]",
      },
    ],
  },
  {
    titulo: "Concluído",
    cartoes: [
      { texto: "Separar encomenda da Lu", tag: "entrega", pr: "bg-[var(--muted)]", feito: true },
      { texto: "Conferir estoque de papel", pr: "bg-[var(--muted)]", feito: true },
    ],
  },
];

export function MockPlanner({ className }: { className?: string }) {
  return (
    <Janela
      url="app.usepolia.com.br/planner"
      label="Quadro do Planner da Pólia com três colunas, Hoje, Em progresso e Concluído, e os cartões de tarefa com categoria e prazo."
      className={className}
    >
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {colunas.map((col, i) => (
          <div key={col.titulo} className={i === 2 ? "hidden md:block" : ""}>
            <p className="font-accent text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              {col.titulo}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {col.cartoes.map((c) => (
                <div
                  key={c.texto}
                  className={`rounded-[10px] border border-[var(--line)] bg-white p-2.5 ${
                    c.feito ? "opacity-55" : ""
                  }`}
                >
                  <p className="text-[11.5px] leading-[1.35] text-[var(--ink)]">{c.texto}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${c.pr}`} />
                    {c.tag && (
                      <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-1.5 py-0.5 text-[9px] text-[var(--ink-soft)]">
                        {c.tag}
                      </span>
                    )}
                    {c.prazo && <span className="text-[9px] text-[var(--muted)]">{c.prazo}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Janela>
  );
}
