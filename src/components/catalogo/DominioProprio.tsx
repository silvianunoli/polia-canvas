import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_MIUDO } from "@/lib/botoes";
import { statusCatalogo } from "@/lib/catalogo.functions";

// Domínio próprio na Vitrine online (26/11/2026, Sil: "esse é um serviço a parte
// que podemos oferecer dentro da pagina de vitrine, a dona da marca nao consegue
// configurar isso por ali"). A dona não liga o domínio sozinha: quem faz é o
// Pólia Lab, com um Worker-porta por marca (lib/lojaDominio.ts) e o domínio na
// lista do Turnstile. Daqui ela só pede, e o pedido vira um chamado.
//
// Quem já tem domínio aparece pela conexão do canal "catalogo" (a Loveless desde
// 29/10): no lugar da oferta, o endereço dela.

export const ASSUNTO_DOMINIO = "dominio" as const;

export function DominioProprio({ userId, slug }: { userId: string; slug: string }) {
  const status = useQuery({
    queryKey: ["status-catalogo", userId],
    queryFn: () => statusCatalogo(),
    staleTime: 5 * 60 * 1000,
  });
  // Sem saber (carregando ou erro), mostra a oferta: o pior caso é a marca com
  // domínio ver o convite, nunca a loja quebrar.
  const dominio = status.data?.ligado ? status.data.dominio : null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-start gap-3">
        <Globe size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--ink-soft)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-sans text-[14px] font-medium text-[var(--ink)]">
            {dominio ? `No domínio da marca: ${dominio}` : "No domínio da marca"}
          </p>
          {dominio ? (
            <p className="font-sans text-[12px] text-[var(--ink-soft)]">
              A loja abre em {dominio}. É a mesma Vitrine online: o que muda aqui vale lá. Pra
              trocar o domínio, fale com o Pólia Lab pelo Suporte.
            </p>
          ) : (
            <>
              <p className="font-sans text-[12px] text-[var(--ink-soft)]">
                Em vez de one.usepolia.com.br/loja/{slug}, a loja abre em suamarca.com.br. É a mesma
                Vitrine online, com os mesmos produtos, pedidos e cupons. Quem liga o domínio é o
                Pólia Lab, como serviço à parte, e o valor sai na conversa.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <LinkInterno
                  href={`/chamados?novo=1&assunto=${ASSUNTO_DOMINIO}`}
                  className={BTN_MIUDO}
                  data-track="dominio_proprio_pedido"
                >
                  Pedir o domínio próprio
                </LinkInterno>
                <span className="font-sans text-[12px] text-[var(--muted)]">
                  O pedido vira um chamado e a resposta chega em Seus chamados.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
