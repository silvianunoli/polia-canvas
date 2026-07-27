export function hojeISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

export function mesAnoDe(iso: string): { ano: number; mes: number } {
  const [ano, mes] = iso.split("-").map(Number);
  return { ano, mes };
}

export function mesAnoAtual(): { ano: number; mes: number } {
  return mesAnoDe(hojeISO());
}

export function ehMesAtual(iso: string): boolean {
  const { ano, mes } = mesAnoAtual();
  const alvo = mesAnoDe(iso);
  return alvo.ano === ano && alvo.mes === mes;
}
