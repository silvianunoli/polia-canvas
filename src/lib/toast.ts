import { toast } from "sonner";

interface ToastOpts {
  action?: { label: string; onClick: () => void };
}

/** Some sozinho em ~4s. Pra feedback passageiro que não exige decisão. */
export function toastSucesso(mensagem: string, opts?: ToastOpts) {
  return toast.success(mensagem, { duration: 4000, action: opts?.action });
}

/** Some sozinho em ~4s. Pra feedback neutro (copiado, desfeito, aviso leve). */
export function toastInfo(mensagem: string, opts?: ToastOpts) {
  return toast(mensagem, { duration: 4000, action: opts?.action });
}

// O sonner só expõe uma região aria-live="polite" única pra todos os toasts —
// não dá pra marcar um toast individual como assertive por ele. Erro precisa
// de aria-live="assertive" de verdade (não pode depender de alguém notar um
// toast que some sozinho), então mantemos uma região só-leitor-de-tela à
// parte pra anunciar erros.
function getAssertiveRegion(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById("toast-assertive-live") as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-assertive-live";
    el.setAttribute("role", "alert");
    el.setAttribute("aria-live", "assertive");
    el.className = "sr-only";
    document.body.appendChild(el);
  }
  return el;
}

/** Fica ~6s (ou até fechar). Também anuncia via aria-live="assertive". */
export function toastErro(mensagem: string, opts?: ToastOpts) {
  const region = getAssertiveRegion();
  if (region) {
    region.textContent = "";
    window.setTimeout(() => {
      region.textContent = mensagem;
    }, 30);
  }
  return toast.error(mensagem, { duration: 6000, action: opts?.action });
}
