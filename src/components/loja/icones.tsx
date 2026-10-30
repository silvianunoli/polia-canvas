import { Clock, ImageOff, Truck, Wallet } from "lucide-react";
import type { IconeSelo } from "@/lib/lojaVitrine";

/** Logo do WhatsApp (o lucide não tem marca); o mesmo do modelo do Lab. */
export function IconeWhatsapp(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={props.className}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.2-.2-.2-.4-.3Z" />
    </svg>
  );
}

export function IconeSeloLoja({ icone }: { icone: IconeSelo }) {
  const props = { "aria-hidden": true, strokeWidth: 1.7 } as const;
  if (icone === "relogio") return <Clock {...props} />;
  if (icone === "carteira") return <Wallet {...props} />;
  if (icone === "entrega") return <Truck {...props} />;
  return <IconeWhatsapp />;
}

/** Produto sem foto: um quadro neutro no lugar, sem inventar imagem. */
export function SemFoto() {
  return (
    <span className="sem-foto" aria-hidden="true">
      <ImageOff strokeWidth={1.5} />
    </span>
  );
}
