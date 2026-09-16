import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido. Confere o @.").max(255),
});

/**
 * Estado e envio do link de redefinição de senha — usado pela rota
 * /auth/esqueci-senha e pelo modo "recuperar" inline de /auth/login, pra
 * não duplicar a chamada ao Supabase em dois lugares.
 */
export function useRecuperarSenha() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendLink(target: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/redefinir-senha`,
    });
    if (error) {
      toastErro("Não conseguimos enviar agora. Tenta de novo em alguns segundos.");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setLoading(true);
    const ok = await sendLink(parsed.data.email);
    setLoading(false);
    if (ok) {
      setSent(parsed.data.email);
      setCooldown(60);
    }
  }

  async function handleResend() {
    if (!sent || cooldown > 0) return;
    setLoading(true);
    const ok = await sendLink(sent);
    setLoading(false);
    if (ok) setCooldown(60);
  }

  function reset() {
    setEmail("");
    setError(undefined);
    setSent(null);
    setCooldown(0);
  }

  return {
    email,
    setEmail,
    error,
    setError,
    loading,
    sent,
    cooldown,
    handleSubmit,
    handleResend,
    reset,
  };
}
