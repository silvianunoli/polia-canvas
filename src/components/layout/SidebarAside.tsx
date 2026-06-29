import type { ReactNode } from "react";
import { PlaceholderImage } from "@/components/PlaceholderImage";

interface SidebarAsideProps {
  /** Rótulo curto em accent caps (ex.: "DICA DA RAPOSA"). */
  label?: string;
  /** Frase curta em Caveat (microcopy emocional). */
  caveat?: string;
  /** Conteúdo extra (filtros, resumo, etc.). */
  children?: ReactNode;
  /** Mostra a Raposa em placeholder no topo. */
  showRaposa?: boolean;
}

/**
 * Aside contextual usado nos hubs (Biblioteca, Vitrine, Clientes).
 * Renderiza em coluna direita ≥lg; em mobile some sem quebrar o layout.
 */
export function SidebarAside({
  label = "DICA DA RAPOSA",
  caveat,
  children,
  showRaposa = true,
}: SidebarAsideProps) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 flex flex-col gap-4">
        {showRaposa && (
          <PlaceholderImage
            slot="raposa-aside"
            description="raposa · estado calmo"
            width={180}
            height={180}
            rounded={16}
          />
        )}
        <div
          className="rounded-2xl border bg-white p-5"
          style={{ borderColor: "rgba(26,26,46,0.06)" }}
        >
          <p className="mb-2 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-polia-terracota">
            {label}
          </p>
          {caveat && (
            <p className="mb-3 caveat-decorativo leading-snug text-polia-noite">{caveat}</p>
          )}
          {children}
        </div>
      </div>
    </aside>
  );
}
