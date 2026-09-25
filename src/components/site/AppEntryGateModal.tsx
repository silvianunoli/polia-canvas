import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";

// App Android/iOS: quem abre o app sem sessão cai na Home igual ao site, mas
// aqui a gente pergunta de cara se já é usuária — evita ela ter que caçar o
// botão de entrar no meio da página de marketing. "Quero conhecer primeiro"
// só fecha o modal; ela navega a Home normalmente dali (inclusive pra
// preços/checkout). Sessão ativa pula esse modal (ver useAppEntryGate).
//
// Usa o primitive de Dialog do Radix (já uma dependência do projeto, ver
// alert-dialog.tsx/sheet.tsx) só pela mecânica: ele move o foco pra dentro do
// modal ao montar e prende o Tab lá dentro sozinho, sem precisar reescrever
// isso à mão. O visual (framer-motion, classes, textos) continua idêntico.
// Escape e clique fora ficam desligados de propósito: o modal só fecha pelas
// duas ações explícitas, igual já era antes.
export function AppEntryGateModal({ onExplorar }: { onExplorar: () => void }) {
  return (
    <Dialog.Root defaultOpen modal>
      <Dialog.Portal>
        <Dialog.Overlay className="polia-v3 fixed inset-0 z-[1000] bg-black/40" />
        <Dialog.Content
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="polia-v3 fixed inset-0 z-[1000] flex items-end justify-center p-4 outline-none md:items-center"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[380px] rounded-[var(--radius-xl)] border border-[var(--line)] bg-white p-6"
          >
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Antes de começar
            </p>
            <Dialog.Title asChild>
              <h2 className="font-cabinet mt-2 text-[22px] leading-[1.2] text-[var(--ink)]">
                Você já é usuária da Pólia?
              </h2>
            </Dialog.Title>
            <Dialog.Description asChild>
              <p className="mt-2 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
                Se já tem conta, entre direto. Se não, dá uma olhada em como funciona antes de
                decidir.
              </p>
            </Dialog.Description>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                to="/auth/login"
                className="rounded-lg bg-[var(--secondary)] px-6 py-3.5 text-center text-[16px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
              >
                Já tenho conta
              </Link>
              <button
                type="button"
                onClick={onExplorar}
                className="rounded-lg border border-[var(--ink)] px-6 py-3.5 text-[16px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-white"
              >
                Quero conhecer primeiro
              </button>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
