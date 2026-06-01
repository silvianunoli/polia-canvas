import { useEffect } from "react";
import { CosmicButton } from "./CosmicButton";

interface LogoutModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function LogoutModal({ open, onCancel, onConfirm, loading }: LogoutModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,26,46,0.85)] px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[380px] rounded-2xl border border-[rgba(201,107,62,0.25)] bg-[rgba(15,15,31,0.95)] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center font-serif text-[32px] leading-tight text-polia-marrom">
          Tem certeza que quer sair?
        </h2>
        <p className="mt-3 text-center font-sans text-[15px] text-polia-marrom/70/80">
          Seus dados ficam salvos. É só entrar de novo quando quiser continuar.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <CosmicButton
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className="!h-[52px] !text-[16px]"
          >
            Sair
          </CosmicButton>
          <CosmicButton variant="ghost" onClick={onCancel} disabled={loading}>
            Continuar aqui
          </CosmicButton>
        </div>
      </div>
    </div>
  );
}
