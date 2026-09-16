import type { ImgHTMLAttributes, SVGProps } from "react";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "role">;
type WordmarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  /** "light" (padrão) é pra fundo claro (`--bg`); "dark" é pra fundo escuro
   *  (`--ink`), como o rodapé — arquivo com as cores invertidas. */
  variant?: "light" | "dark";
};

/**
 * Wordmark completa com o selo "ONE" (16/09/2026). Usa os arquivos de verdade
 * (`public/logotipo-wordmark-ligth-one.svg` / `-dark-one.svg`, o mesmo lockup
 * dos e-mails transacionais) em vez de redesenhar o selo em paths à mão — cada
 * arquivo já traz cor e fundo fixos pro contexto certo, então não segue mais
 * `currentColor`: escolha a variante certa em vez de `text-[var(--ink)]`/
 * `text-[var(--bg)]`, que não têm mais efeito aqui.
 */
export function PoliaWordmark({ className, variant = "light", ...props }: WordmarkProps) {
  return (
    <img
      src={variant === "dark" ? "/logotipo-wordmark-dark-one.svg" : "/logotipo-wordmark-ligth-one.svg"}
      alt="Pólia One"
      className={className}
      {...props}
    />
  );
}

/**
 * Símbolo isolado (sem a palavra), pra espaços pequenos: sidebar colapsada,
 * avatar, favicon. Mesma regra de cor da wordmark.
 */
export function PoliaIcon({ className, ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="Pólia"
      fill="currentColor"
      className={className}
      {...props}
    >
      <rect x="26" y="18" width="15" height="64" rx="7.5" />
      <circle cx="54" cy="34" r="16" fill="none" stroke="currentColor" strokeWidth="9" />
      <circle cx="60" cy="84" r="4" fill="var(--secondary)" />
      <circle cx="72" cy="86" r="5" fill="var(--accent)" />
      <circle cx="86" cy="88" r="7" fill="var(--highlight)" />
    </svg>
  );
}
