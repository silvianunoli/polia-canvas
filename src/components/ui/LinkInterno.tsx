import type { AnchorHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";

type LinkInternoProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

/**
 * Troca direta de um <a href> interno: navega pelo router em vez de recarregar
 * a página inteira. O recarregamento refazia o beforeLoad da área logada e fazia
 * a barra lateral piscar "0 dias de presença" e cadeados antes de corrigir.
 * Aceita href com query ("/upgrade?rota=..."), que o `to` do Link não entende.
 */
export function LinkInterno({ href, ...rest }: LinkInternoProps) {
  const [semHash, hash] = href.split("#");
  const [to, query] = semHash.split("?");
  const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
  return <Link to={to} search={search as never} hash={hash} {...rest} />;
}
