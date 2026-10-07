// Com "Confirm email" ligado, o Supabase Auth não devolve erro quando o e-mail
// já tem conta (proteção contra enumeração): responde 200, não manda e-mail
// nenhum e devolve um user falso com identities vazio. Sem esta checagem o
// /auth/cadastro mandava pra "confira seu e-mail" e nada chegava (ONE-79).
// O formato com error.message cobre o caso em que a proteção estiver desligada.
type RespostaSignup = {
  user: { identities?: unknown[] | null } | null;
};

export function emailJaTemConta(
  data: RespostaSignup | null | undefined,
  error: { message: string } | null | undefined,
): boolean {
  if (error) return /already/i.test(error.message) || /registered/i.test(error.message);
  return !!data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
}
