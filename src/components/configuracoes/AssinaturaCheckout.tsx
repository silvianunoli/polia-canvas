import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripeClient";
import { toastErro } from "@/lib/toast";

export function AssinaturaCheckout({
  clientSecret,
  onClose,
  onSucesso,
}: {
  clientSecret: string;
  onClose: () => void;
  onSucesso: () => void;
}) {
  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
          ASSINATURA
        </p>
        <h2 className="mb-6 text-[26px] text-[var(--ink)]">Confirmar pagamento</h2>
        <Elements stripe={getStripe()} options={{ clientSecret }}>
          <FormularioPagamento onClose={onClose} onSucesso={onSucesso} />
        </Elements>
      </div>
    </div>
  );
}

function FormularioPagamento({
  onClose,
  onSucesso,
}: {
  onClose: () => void;
  onSucesso: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = async () => {
    if (!stripe || !elements) return;
    setErro(null);
    setConfirmando(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setConfirmando(false);
    if (error) {
      setErro(error.message ?? "Não conseguimos confirmar o pagamento. Tenta outro cartão.");
      return;
    }
    if (
      paymentIntent &&
      (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")
    ) {
      onSucesso();
      return;
    }
    setErro("O pagamento não foi confirmado. Tenta de novo.");
  };

  return (
    <div>
      <PaymentElement />
      {erro && <p className="mt-3 font-sans text-[13px] text-[var(--danger)]">{erro}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={confirmando}
          className="rounded-xl border border-[var(--line)] px-4 py-2 font-sans text-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            confirmar().catch(() => {
              setConfirmando(false);
              toastErro("Não conseguimos confirmar o pagamento agora. Tenta de novo.");
            });
          }}
          disabled={!stripe || confirmando}
          className="rounded-xl bg-[var(--secondary)] px-4 py-2 font-sans text-[13px] font-semibold text-[var(--secondary-ink)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirmando ? "Confirmando..." : "Confirmar assinatura"}
        </button>
      </div>
    </div>
  );
}
