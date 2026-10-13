import { useState } from "react";
import {
  AddressElement,
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripeClient";
import { salvarDadosFiscais } from "@/lib/stripe.functions";
import { Campo } from "@/components/ui/Campo";
import {
  formatarDocumento,
  soDigitos,
  tipoDocumento,
} from "../../../supabase/functions/_shared/documentoFiscal";
import { toastErro } from "@/lib/toast";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";

export function AssinaturaCheckout({
  clientSecret,
  onClose,
  onSucesso,
  returnUrl,
  resumo,
}: {
  clientSecret: string;
  onClose: () => void;
  onSucesso: () => void;
  /** "Premium, R$ 29,90 por mês" (resumoDoPlano). Sem ele, o texto genérico. */
  resumo?: string | null;
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
      description={
        resumo
          ? `Pólia One ${resumo}. A cobrança se renova sozinha e dá pra cancelar quando quiser, em Configurações. O pagamento é processado pelo Stripe.`
          : "Assinatura da Pólia One. O pagamento é processado pelo Stripe."
      }
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
  const [documento, setDocumento] = useState("");
  const [erroDocumento, setErroDocumento] = useState<string | undefined>();

  const confirmar = async () => {
    if (!stripe || !elements) return;
    setErro(null);

    // Nota fiscal (PAY-32): CPF/CNPJ e endereço são obrigatórios e vão pro
    // Stripe ANTES da cobrança, pra nota sair certa quando a fatura for paga.
    const tipo = tipoDocumento(documento);
    if (!tipo) {
      setErroDocumento(
        soDigitos(documento).length === 0
          ? "Preenche o CPF ou CNPJ pra nota fiscal."
          : "Confere o CPF ou CNPJ: o número não fecha.",
      );
      return;
    }
    setErroDocumento(undefined);
    const enderecoEl = elements.getElement(AddressElement);
    const endereco = enderecoEl ? await enderecoEl.getValue() : null;
    if (!endereco?.complete) {
      setErro("Preenche o endereço completo pra nota fiscal.");
      return;
    }

    setConfirmando(true);
    const v = endereco.value;
    const salvo = await salvarDadosFiscais({
      data: {
        documento,
        nome: v.name,
        endereco: {
          line1: v.address.line1,
          line2: v.address.line2,
          city: v.address.city,
          state: v.address.state,
          postal_code: v.address.postal_code,
          country: "BR",
        },
      },
    });
    if (!salvo.ok) {
      setConfirmando(false);
      setErro(salvo.error);
      return;
    }

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
      <div className="mb-4">
        <Campo
          label="CPF ou CNPJ"
          required
          error={erroDocumento}
          hint="Vai na nota fiscal, que chega no seu e-mail."
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={documento}
            onChange={(e) => {
              setDocumento(formatarDocumento(e.target.value));
              if (erroDocumento) setErroDocumento(undefined);
            }}
            onBlur={() => {
              if (soDigitos(documento).length > 0 && !tipoDocumento(documento)) {
                setErroDocumento("Confere o CPF ou CNPJ: o número não fecha.");
              }
            }}
            disabled={confirmando}
            placeholder="000.000.000-00"
            className="w-full h-[48px] border border-[var(--line)] rounded-xl px-4 font-sans text-[var(--ink)] text-[15px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--secondary-text)] transition-[border-color,box-shadow] disabled:opacity-60"
          />
        </Campo>
      </div>
      <div className="mb-4">
        <AddressElement
          options={{
            mode: "billing",
            allowedCountries: ["BR"],
            defaultValues: { address: { country: "BR" } },
          }}
        />
      </div>
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
