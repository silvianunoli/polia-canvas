import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Campo } from "@/components/ui/Campo";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { Switch } from "@/components/ui/switch";
import { BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import {
  envioVazio,
  lerMedida,
  pendenciasDoEnvio,
  problemasDoEnvio,
  type EnvioLoja,
} from "@/lib/envioLoja";
import {
  buscarCep,
  desconectarMelhorEnvio,
  iniciarConexaoMelhorEnvio,
  salvarEnvioLoja,
  statusEnvioLoja,
} from "@/lib/envioLoja.functions";

// Card "Envio da loja" em Configurações > Integrações (ONE-189). Só aparece em conta com
// loja de marca. Liga o Melhor Envio e guarda o que o frete e a etiqueta precisam: CEP de
// origem, caixa padrão, remetente (privado) e a retirada (só quem pagou vê as instruções).

export const CHAVE_STATUS_ENVIO = "status-envio-loja";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

type Medidas = { pesoKg: string; alturaCm: string; larguraCm: string; comprimentoCm: string };
const texto = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

function Medida({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <Campo label={label}>
      <input inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </Campo>
  );
}

export function CardEnvioLoja({ userId }: { userId: string | undefined }) {
  const qc = useQueryClient();
  const statusQuery = useQuery({
    queryKey: [CHAVE_STATUS_ENVIO, userId],
    enabled: !!userId,
    queryFn: () => statusEnvioLoja(),
  });
  const status = statusQuery.data;

  const [envio, setEnvio] = useState<EnvioLoja>(envioVazio());
  const [medidas, setMedidas] = useState<Medidas>({ pesoKg: "", alturaCm: "", larguraCm: "", comprimentoCm: "" });
  const [carregado, setCarregado] = useState(false);
  const [confirmandoDesconectar, setConfirmandoDesconectar] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (carregado || !status?.envio) return;
    setEnvio(status.envio);
    const c = status.envio.caixaPadrao;
    setMedidas({
      pesoKg: texto(c.pesoKg),
      alturaCm: texto(c.alturaCm),
      larguraCm: texto(c.larguraCm),
      comprimentoCm: texto(c.comprimentoCm),
    });
    setCarregado(true);
  }, [carregado, status]);

  const conectar = useMutation({
    mutationFn: () => iniciarConexaoMelhorEnvio(),
    onSuccess: (res) => {
      if (!res.url) {
        toastErro(res.error ?? "A Pólia One não conseguiu conectar com o Melhor Envio agora.");
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro("A Pólia One não conseguiu iniciar a conexão com o Melhor Envio."),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarMelhorEnvio(),
    onSuccess: (res) => {
      if (!res.ok) {
        toastErro(res.error ?? "A Pólia One não conseguiu desconectar agora.");
        return;
      }
      setConfirmandoDesconectar(false);
      qc.invalidateQueries({ queryKey: [CHAVE_STATUS_ENVIO, userId] });
      toastSucesso("Melhor Envio desconectado.");
    },
    onError: () => toastErro("A Pólia One não conseguiu desconectar agora."),
  });

  const caixa = {
    pesoKg: lerMedida(medidas.pesoKg),
    alturaCm: lerMedida(medidas.alturaCm),
    larguraCm: lerMedida(medidas.larguraCm),
    comprimentoCm: lerMedida(medidas.comprimentoCm),
  };
  const medidaRuim = Object.values(caixa).some((v) => v != null && Number.isNaN(v));
  const paraSalvar: EnvioLoja = { ...envio, caixaPadrao: caixa };
  const problemas = medidaRuim ? ["Use só números nas medidas da caixa."] : problemasDoEnvio(paraSalvar);

  const salvar = useMutation({
    mutationFn: () => salvarEnvioLoja({ data: paraSalvar }),
    onSuccess: (res) => {
      if (!res.ok) {
        toastErro(res.error ?? "A Pólia One não conseguiu salvar o envio.");
        return;
      }
      qc.invalidateQueries({ queryKey: [CHAVE_STATUS_ENVIO, userId] });
      toastSucesso("Envio da loja salvo.");
    },
    onError: () => toastErro("A Pólia One não conseguiu salvar o envio. Tenta de novo."),
  });

  if (!status?.temLoja) return null;

  const mudarRemetente = (m: Partial<EnvioLoja["remetente"]>) =>
    setEnvio((e) => ({ ...e, remetente: { ...e.remetente, ...m } }));

  const completarPeloCep = async () => {
    setBuscandoCep(true);
    const end = await buscarCep({ data: { cep: envio.remetente.cep } }).catch(() => null);
    setBuscandoCep(false);
    if (!end) {
      toastErro("A Pólia One não achou esse CEP. Preencha o endereço à mão.");
      return;
    }
    mudarRemetente({
      rua: end.rua || envio.remetente.rua,
      bairro: end.bairro || envio.remetente.bairro,
      cidade: end.cidade || envio.remetente.cidade,
      uf: end.uf || envio.remetente.uf,
    });
  };

  const { conexao } = status;
  const pendencias = pendenciasDoEnvio(status.envio ?? envioVazio());

  return (
    <>
      <div className="p-4 border border-[var(--line)] rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-[var(--ink)] text-[14px] font-medium mb-0.5">
              Envio da loja · Melhor Envio
              {conexao.status === "conectada" && conexao.nome ? ` · ${conexao.nome}` : ""}
            </p>
            <p className="font-sans text-[var(--ink-soft)] text-[12px]">
              {conexao.status === "conectada"
                ? "conectado · a loja cota o frete e a etiqueta sai pela Pólia One"
                : "o frete da loja é calculado pelo CEP e a etiqueta sai com o saldo do Melhor Envio"}
            </p>
          </div>
          {conexao.status === "conectada" ? (
            <button
              type="button"
              onClick={() => setConfirmandoDesconectar(true)}
              className={`${BTN_MIUDO} hover:border-[var(--danger)] hover:text-[var(--danger)]`}
            >
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => conectar.mutate()}
              disabled={conectar.isPending}
              className={BTN_MIUDO}
            >
              {conectar.isPending
                ? "Conectando..."
                : conexao.status === "erro"
                  ? "Conectar de novo"
                  : "Conectar"}
            </button>
          )}
        </div>
        {conexao.erro && (
          <p className="font-sans text-[var(--danger)] text-[12px] mt-2" role="alert">
            {conexao.erro}
          </p>
        )}
        {pendencias.length > 0 && (
          <p className="font-sans text-[var(--ink-soft)] text-[12px] mt-2">
            Falta para o frete funcionar: {pendencias.join(", ")}.
          </p>
        )}

        <form
          className="mt-4 border-t border-[var(--line)] pt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (problemas.length) {
              toastErro(problemas[0]);
              return;
            }
            salvar.mutate();
          }}
        >
          <Campo label="CEP de onde os pacotes saem">
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              value={envio.cepOrigem}
              maxLength={9}
              onChange={(e) => setEnvio({ ...envio, cepOrigem: e.target.value })}
              className={INPUT}
            />
          </Campo>

          <fieldset>
            <legend className="mb-1 text-[12px] font-medium text-[var(--ink-soft)]">
              Caixa padrão, para produto sem medida
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Medida label="Peso (kg)" valor={medidas.pesoKg} onChange={(v) => setMedidas({ ...medidas, pesoKg: v })} />
              <Medida label="Altura (cm)" valor={medidas.alturaCm} onChange={(v) => setMedidas({ ...medidas, alturaCm: v })} />
              <Medida label="Largura (cm)" valor={medidas.larguraCm} onChange={(v) => setMedidas({ ...medidas, larguraCm: v })} />
              <Medida
                label="Comprimento (cm)"
                valor={medidas.comprimentoCm}
                onChange={(v) => setMedidas({ ...medidas, comprimentoCm: v })}
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[12px] font-medium text-[var(--ink-soft)]">
              Remetente da etiqueta (não aparece no site)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo label="Nome ou razão social">
                <input value={envio.remetente.nome} maxLength={120} onChange={(e) => mudarRemetente({ nome: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="CPF ou CNPJ">
                <input inputMode="numeric" value={envio.remetente.documento} maxLength={18} onChange={(e) => mudarRemetente({ documento: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="Telefone com DDD">
                <input type="tel" inputMode="tel" value={envio.remetente.telefone} maxLength={20} onChange={(e) => mudarRemetente({ telefone: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="E-mail">
                <input type="email" value={envio.remetente.email} maxLength={200} onChange={(e) => mudarRemetente({ email: e.target.value })} className={INPUT} />
              </Campo>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <Campo label="CEP do remetente">
                <input inputMode="numeric" value={envio.remetente.cep} maxLength={9} onChange={(e) => mudarRemetente({ cep: e.target.value })} className={INPUT} />
              </Campo>
              <button type="button" onClick={completarPeloCep} disabled={buscandoCep} className={`${BTN_MIUDO} mb-0.5`}>
                {buscandoCep ? "Buscando..." : "Preencher pelo CEP"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Campo label="Rua">
                <input value={envio.remetente.rua} maxLength={160} onChange={(e) => mudarRemetente({ rua: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="Número">
                <input value={envio.remetente.numero} maxLength={20} onChange={(e) => mudarRemetente({ numero: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="Complemento">
                <input value={envio.remetente.complemento} maxLength={80} onChange={(e) => mudarRemetente({ complemento: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="Bairro">
                <input value={envio.remetente.bairro} maxLength={80} onChange={(e) => mudarRemetente({ bairro: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="Cidade">
                <input value={envio.remetente.cidade} maxLength={80} onChange={(e) => mudarRemetente({ cidade: e.target.value })} className={INPUT} />
              </Campo>
              <Campo label="UF">
                <input value={envio.remetente.uf} maxLength={2} onChange={(e) => mudarRemetente({ uf: e.target.value.toUpperCase() })} className={INPUT} />
              </Campo>
            </div>
          </fieldset>

          <div className="grid gap-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[var(--ink)] text-[13px] font-medium mb-0.5">Oferecer retirada</p>
                <p className="font-sans text-[var(--ink-soft)] text-[12px]">
                  A compradora escolhe buscar o pedido, sem frete.
                </p>
              </div>
              <Switch
                checked={envio.retirada.ativa}
                onCheckedChange={(ativa) => setEnvio({ ...envio, retirada: { ...envio.retirada, ativa } })}
                aria-label="Oferecer retirada na loja"
              />
            </div>
            {envio.retirada.ativa && (
              <Campo label="Como funciona a retirada" hint="Só quem já pagou vê, na página do pedido e no e-mail.">
                <textarea
                  value={envio.retirada.instrucoes}
                  maxLength={600}
                  rows={3}
                  onChange={(e) => setEnvio({ ...envio, retirada: { ...envio.retirada, instrucoes: e.target.value } })}
                  className={INPUT}
                />
              </Campo>
            )}
          </div>

          <div>
            <button type="submit" disabled={salvar.isPending || !carregado} className={BTN_MIUDO}>
              {salvar.isPending ? "Salvando..." : "Salvar envio"}
            </button>
          </div>
        </form>
      </div>
      <ConfirmarAcao
        open={confirmandoDesconectar}
        onOpenChange={(aberto) => {
          if (!desconectar.isPending) setConfirmandoDesconectar(aberto);
        }}
        titulo="Desconectar o Melhor Envio?"
        descricao="A loja para de cotar frete e as etiquetas não saem mais pela Pólia One. O que já foi enviado continua no Melhor Envio."
        textoConfirmar="Desconectar"
        textoCarregando="Desconectando..."
        destrutivo
        carregando={desconectar.isPending}
        onConfirmar={() => desconectar.mutateAsync()}
      />
    </>
  );
}
