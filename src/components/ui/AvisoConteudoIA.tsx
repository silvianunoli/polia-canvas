interface AvisoConteudoIAProps {
  texto: string;
}

/**
 * Aviso de conteúdo gerado por IA, mesmo tratamento da Aimer: fixo abaixo do
 * cabeçalho, em todos os estados (carregando, gerado, erro), sem dispensar.
 * Bloco copiado idêntico em plano-conteudo.tsx e raiox.tsx, extraído numa
 * rodada de limpeza de duplicação (set/2026). --muted #6B6B6B sobre --bg
 * #F2F0ED dá 4,7:1, passa AA em 14px.
 */
export function AvisoConteudoIA({ texto }: AvisoConteudoIAProps) {
  return (
    <p className="mt-3 max-w-[64ch] font-sans text-[14px] leading-[1.5] text-[var(--muted)]">
      {texto}
    </p>
  );
}
