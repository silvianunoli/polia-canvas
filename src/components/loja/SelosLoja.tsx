import type { LojaPublica } from "@/lib/loja";
import { selosDaLoja } from "@/lib/lojaVitrine";
import { IconeSeloLoja } from "./icones";

/** Selos de confiança da vitrine: só o que a dona configurou. */
export function SelosLoja({ loja }: { loja: LojaPublica }) {
  const selos = selosDaLoja(loja);
  return (
    <ul className="selos" aria-label="Como a loja trabalha">
      {selos.map((s) => (
        <li key={s.icone} className="selo">
          <IconeSeloLoja icone={s.icone} />
          <div>
            <b>{s.titulo}</b>
            <span>{s.texto}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Os mesmos selos em lista, na página do produto. */
export function BeneficiosLoja({ loja }: { loja: LojaPublica }) {
  return (
    <ul className="beneficios">
      {selosDaLoja(loja).map((s) => (
        <li key={s.icone}>
          <IconeSeloLoja icone={s.icone} />
          <span>
            <b>{s.titulo}</b>, {s.texto}
          </span>
        </li>
      ))}
    </ul>
  );
}
