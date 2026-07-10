// Dispara um alerta crítico pro Telegram via edge function alertas-criticos.
// Fire-and-forget: nunca deixa uma falha de alerta interromper o fluxo
// principal (checkout, cancelamento etc.) — só loga se não conseguir disparar.
export async function dispararAlerta(
  tipo: string,
  titulo: string,
  detalhes?: Record<string, unknown>,
  link?: string,
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.ALERTAS_SECRET;
  if (!supabaseUrl || !secret) {
    console.error("[Alertas] Missing SUPABASE_URL/ALERTAS_SECRET — alerta não disparado:", tipo);
    return;
  }
  try {
    await fetch(`${supabaseUrl}/functions/v1/alertas-criticos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-alertas-secret": secret },
      body: JSON.stringify({ tipo, titulo, detalhes, link }),
    });
  } catch (err) {
    console.error("[Alertas] Falha ao chamar alertas-criticos:", err);
  }
}
