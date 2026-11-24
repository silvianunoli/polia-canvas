import { useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import {
  ANTECEDENCIAS,
  REPETICOES,
  ROTULO_ANTECEDENCIA,
  ROTULO_REPETICAO,
  ehAntecedencia,
  type Lembrete,
  type Repeticao,
} from "../../../supabase/functions/_shared/lembretesCalendario";
import type { LembreteParaSalvar } from "./lembretesDados";

// Formulário do lembrete do Calendário (ONE-244). Cria (sem `lembrete`) ou edita.
// Mora no painel lateral do dia, no lugar da lista, enquanto está aberto.

const CAMPO =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary-text)] disabled:opacity-60";

/** Aviso padrão de lembrete novo: 1 dia antes. */
const AVISO_PADRAO = 1;

export function FormLembrete({
  dia,
  lembrete,
  salvando,
  apagando,
  onSalvar,
  onApagar,
  onCancelar,
}: {
  dia: string;
  lembrete?: Lembrete;
  salvando: boolean;
  apagando?: boolean;
  onSalvar: (dados: LembreteParaSalvar) => void;
  onApagar?: () => void;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(lembrete?.titulo ?? "");
  const [data, setData] = useState(lembrete?.dia ?? dia);
  const [horario, setHorario] = useState(lembrete?.horario ?? "");
  const [repeticao, setRepeticao] = useState<Repeticao>(lembrete?.repeticao ?? "nenhuma");
  const [aviso, setAviso] = useState<string>(
    lembrete ? String(lembrete.avisar_dias_antes ?? "") : String(AVISO_PADRAO),
  );
  const [observacao, setObservacao] = useState(lembrete?.observacao ?? "");
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [tentou, setTentou] = useState(false);

  const erroTitulo = tentou && !titulo.trim() ? "Escreva o que é o lembrete." : undefined;
  const erroData = tentou && !data ? "Escolha o dia." : undefined;
  const ocupado = salvando || !!apagando;

  const salvar = () => {
    setTentou(true);
    if (!titulo.trim() || !data) return;
    const n = aviso === "" ? null : Number(aviso);
    onSalvar({
      titulo,
      observacao: observacao || null,
      dia: data,
      horario: horario || null,
      repeticao,
      avisar_dias_antes: ehAntecedencia(n) ? n : null,
    });
  };

  return (
    <form
      className="mb-4 flex flex-col gap-3 rounded-lg border border-[var(--line)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancelar();
      }}
    >
      <Campo label="O que é" error={erroTitulo} required>
        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: mandar o relatório pra contabilidade"
          maxLength={120}
          disabled={ocupado}
          className={CAMPO}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Dia" error={erroData} required>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={ocupado}
            className={CAMPO}
          />
        </Campo>
        <Campo label="Horário (opcional)">
          <input
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            disabled={ocupado}
            className={CAMPO}
          />
        </Campo>
      </div>

      <Campo
        label="Repete"
        hint={
          repeticao === "mensal" && Number(data.slice(8, 10)) > 28
            ? "Nos meses sem esse dia, o lembrete cai no último dia do mês."
            : undefined
        }
      >
        <select
          value={repeticao}
          onChange={(e) => setRepeticao(e.target.value as Repeticao)}
          disabled={ocupado}
          className={CAMPO}
        >
          {REPETICOES.map((r) => (
            <option key={r} value={r}>
              {ROTULO_REPETICAO[r]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        label="Aviso por e-mail"
        hint="Sai às 8h. Com o app da Pólia One no celular, chega lá também."
      >
        <select
          value={aviso}
          onChange={(e) => setAviso(e.target.value)}
          disabled={ocupado}
          className={CAMPO}
        >
          <option value="">Não avisar</option>
          {ANTECEDENCIAS.map((a) => (
            <option key={a} value={String(a)}>
              {ROTULO_ANTECEDENCIA[a]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Observação (opcional)">
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: levar o extrato e as notas do mês"
          maxLength={500}
          rows={2}
          disabled={ocupado}
          className={`${CAMPO} resize-y`}
        />
      </Campo>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {lembrete && onApagar ? (
          confirmarApagar ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[var(--ink-soft)]">
                {lembrete.repeticao === "nenhuma"
                  ? "Apagar este lembrete?"
                  : "Apagar o lembrete e todas as repetições?"}
              </span>
              <button
                type="button"
                onClick={onApagar}
                disabled={ocupado}
                className={`${BTN_MIUDO} min-h-11 !border-[var(--danger)] text-[var(--danger)]`}
              >
                {apagando ? "Apagando..." : "Apagar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmarApagar(false)}
                disabled={ocupado}
                className={`${BTN_MIUDO} min-h-11`}
              >
                Manter
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarApagar(true)}
              disabled={ocupado}
              className="min-h-11 text-[13px] text-[var(--danger)] hover:underline disabled:opacity-60"
            >
              Apagar lembrete
            </button>
          )
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className={BTN_ACAO_CONTORNO}
          >
            Cancelar
          </button>
          <button type="submit" disabled={ocupado} className={BTN_ACAO}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </span>
      </div>
    </form>
  );
}
