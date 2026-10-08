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
  returnUrl,
}: {
  clientSecret: string;
  onClose: () => void;
  onSucesso: () => void;
  /**
   * Pra onde o Stripe devolve quando o meio de pagamento exige sair do site
   * (redirect). Sem ele, um meio desses fazia o confirmPayment falhar com
   * "return_url is required". Cartão (com ou sem 3DS) não usa: fica no modal.
   */
  returnUrl?: string;
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
        <FormularioPagamento onClose={onClose} onSucesso={onSucesso} returnUrl={returnUrl} />
      </Elements>
    </Modal>
  );
}

function FormularioPagamento({
  onClose,
  onSucesso,
  returnUrl,
}: {
  onClose: () => void;
  onSucesso: () => void;
  returnUrl?: string;
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
      // "if_required": cartão confirma aqui mesmo; só meio com redirecionamento
      // sai pro return_url (e volta pro /assinar, que conclui a ativação).
      ...(returnUrl ? { confirmParams: { return_url: returnUrl } } : {}),
      redirect: "if_required",
    });
    setConfirmando(false);
    if (error) {
      setErro(
        error.message ?? "A Pólia One não conseguiu confirmar o pagamento. Tenta outro cartão.",
      );
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
              toastErro("A Pólia One não conseguiu confirmar o pagamento agora. Tenta de novo.");
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
