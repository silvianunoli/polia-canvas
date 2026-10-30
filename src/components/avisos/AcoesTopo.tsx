import { BotaoSuporte } from "./BotaoSuporte";
import { SinoAvisos } from "./SinoAvisos";

/** Suporte + sino, lado a lado. O mesmo par no topo do computador, no celular e na aba Mais do app. */
export function AcoesTopo({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className="polia-v3 flex items-center gap-1">
      <BotaoSuporte compacto={compacto} />
      <SinoAvisos />
    </div>
  );
}
