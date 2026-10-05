import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripeClient";
import { toastErro } from "@/lib/toast";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";

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
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
      title="Confirmar pagamento"
      description="Assinatura da Pólia One. O pagamento é processado pelo Stripe."
    >
      <Elements stripe={getStripe()} options={{ clientSecret }}>
        <FormularioPagamento onClose={onClose} onSucesso={onSucesso} />
      </Elements>
    </Modal>
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
      setErro(error.message ?? "A Pólia não conseguiu confirmar o pagamento. Tenta outro cartão.");
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
      {erro && (
        <p role="alert" className="mt-3 font-sans text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={confirmando}
          className={BTN_ACAO_CONTORNO}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            confirmar().catch(() => {
              setConfirmando(false);
              toastErro("A Pólia não conseguiu confirmar o pagamento agora. Tenta de novo.");
            });
          }}
          disabled={!stripe || confirmando}
          className={BTN_ACAO}
        >
          {confirmando ? "Confirmando..." : "Confirmar assinatura"}
        </button>
      </div>
    </div>
  );
}
