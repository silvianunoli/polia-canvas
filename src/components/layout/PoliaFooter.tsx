/**
 * Rodapé global das rotas autenticadas (Pólia).
 * Mostra um mantra que roda por dia da semana e links institucionais discretos.
 */
const MANTRAS = [
  "cada vez que você volta, encontra mais de você aqui.",
  "negócio que floresce não nasce pronto. floresce.",
  "o caminho é seu — a Pólia só caminha junto.",
  "sua história é o ativo. tudo o mais é ferramenta.",
  "constância vence virada. um passo, todo dia.",
  "respira. seu ritmo importa mais que a velocidade.",
  "essa semana também conta. não precisa ser épica.",
];

export function PoliaFooter() {
  const idx = new Date().getDay(); // 0 (dom) – 6 (sáb)
  const mantra = MANTRAS[idx % MANTRAS.length];

  return (
    <footer
      role="contentinfo"
      className="bg-polia-noite px-6 py-10 text-center md:px-12"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4">
        <p className="font-handwritten text-[18px] leading-snug text-polia-creme/85 md:text-[20px]">
          {mantra}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-sans text-[12px] text-polia-creme/55">
          <a href="/painel" className="hover:text-polia-creme">painel</a>
          <span aria-hidden>·</span>
          <a href="/configuracoes" className="hover:text-polia-creme">configurações</a>
          <span aria-hidden>·</span>
          <a href="/ajuda" className="hover:text-polia-creme">ajuda</a>
          <span aria-hidden>·</span>
          <a href="/privacidade" className="hover:text-polia-creme">privacidade</a>
          <span aria-hidden>·</span>
          <a href="/termos" className="hover:text-polia-creme">termos</a>
        </div>
        <p className="font-accent text-[10px] uppercase tracking-[2px] text-polia-creme/35">
          Pólia · feito pra mulheres empreendedoras
        </p>
      </div>
    </footer>
  );
}
