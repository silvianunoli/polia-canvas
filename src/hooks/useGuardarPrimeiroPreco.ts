import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";
import { avisarAtivacaoNoGA } from "@/lib/ativacaoPreco";
import { registrar } from "@/lib/founder-eventos";
import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";
import {
  PAUSA_PRIMEIRO_PRECO_MS,
  ehErroDeCota,
  nomeParaGuardar,
  tipoDoProduto,
  type PerfilCalculadora,
} from "@/lib/primeiroPreco";

export type EstadoPrimeiroPreco = "esperando" | "guardando" | "guardado" | "erro";

interface Valores {
  perfil: PerfilCalculadora;
  precoVenda: number;
  precoCusto: number | null;
  breakdown: CalculadoraBreakdown;
}

/**
 * Grava o primeiro preço da Calculadora sem botão (GRW-90). A regra de quando
 * vale mora em lib/primeiroPreco.ts; aqui é só a gravação:
 *
 * - `ativo`: a conta entra na regra (sem preço calculado, não é recálculo).
 * - `pronto`: o resultado é válido e já apareceu na tela.
 *
 * Com os dois, espera 2 s sem mudança e grava. O primeiro insert guarda o id;
 * dali pra frente, cada resultado novo e parado atualiza a MESMA linha, mesmo
 * depois que `ativo` vira false (a releitura de "tem preço" já vê o produto).
 * Sair da tela com gravação pendente grava na hora.
 */
export function useGuardarPrimeiroPreco({
  userId,
  ativo,
  pronto,
  valores,
  onCriado,
}: {
  userId: string | undefined;
  ativo: boolean;
  pronto: boolean;
  valores: Valores;
  onCriado?: () => void;
}) {
  const [estado, setEstado] = useState<EstadoPrimeiroPreco>("esperando");
  const [erro, setErro] = useState<string | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState<string | null>(null);

  // Refs pra a gravação ler sempre o valor mais novo, mesmo vinda do timer.
  const valoresRef = useRef(valores);
  valoresRef.current = valores;
  const nomeRef = useRef(nome);
  nomeRef.current = nome;
  const produtoIdRef = useRef<string | null>(null);
  const gravandoRef = useRef(false);
  const deNovoRef = useRef(false);
  const ultimaGravadaRef = useRef<string | null>(null);
  const onCriadoRef = useRef(onCriado);
  onCriadoRef.current = onCriado;

  const chave = JSON.stringify([
    valores.perfil,
    valores.precoVenda,
    valores.precoCusto,
    valores.breakdown,
  ]);

  const gravar = useCallback(async () => {
    if (!userId) return;
    if (gravandoRef.current) {
      // Uma gravação por vez; a que chegou no meio roda logo depois, com o valor novo.
      deNovoRef.current = true;
      return;
    }
    const v = valoresRef.current;
    const chaveAgora = JSON.stringify([v.perfil, v.precoVenda, v.precoCusto, v.breakdown]);
    if (produtoIdRef.current && chaveAgora === ultimaGravadaRef.current) return;

    gravandoRef.current = true;
    setEstado("guardando");
    setErro(null);
    const nomeFinal = nomeParaGuardar(nomeRef.current, v.perfil);
    const tipo = tipoDoProduto(v.perfil);
    const campos = {
      tipo,
      preco_venda: v.precoVenda,
      preco_custo: v.precoCusto,
      calculadora_breakdown: v.breakdown as unknown as Json,
    };

    let falha: string | null = null;
    if (!produtoIdRef.current) {
      const { data, error } = await supabase
        .from("produtos")
        .insert({ user_id: userId, nome: nomeFinal, ...campos } as never)
        .select("id")
        .single();
      if (error || !data) {
        console.error("primeiro_preco_guardar", error);
        falha = ehErroDeCota(error?.message)
          ? "O catálogo do plano Grátis já está cheio, então esse preço não foi guardado. Os números continuam na tela."
          : "A Pólia One não conseguiu guardar esse preço agora. Os números continuam na tela.";
        track("primeiro_preco_falhou", { motivo: error?.message || "erro_desconhecido" });
      } else {
        const id = (data as { id: string }).id;
        produtoIdRef.current = id;
        setProdutoId(id);
        track("produto_criado", { tipo, auto: true });
        void registrar("create_product", {
          feature: "calculadora",
          propriedades: { tipo, auto: true },
        });
        void avisarAtivacaoNoGA(userId, (v.precoCusto ?? 0) > 0);
        onCriadoRef.current?.();
      }
    } else {
      const { error } = await supabase
        .from("produtos")
        .update({ ...campos, updated_at: new Date().toISOString() } as never)
        .eq("id", produtoIdRef.current);
      if (error) {
        console.error("primeiro_preco_atualizar", error);
        falha =
          "A Pólia One não conseguiu atualizar esse preço agora. Os números continuam na tela.";
      }
    }

    gravandoRef.current = false;
    if (falha) {
      setErro(falha);
      setEstado("erro");
    } else {
      ultimaGravadaRef.current = chaveAgora;
      setEstado("guardado");
    }
    if (deNovoRef.current) {
      deNovoRef.current = false;
      void gravar();
    }
  }, [userId]);

  const segueGravando = ativo || produtoId !== null;

  // Declarado ANTES do efeito do timer: na desmontagem o React roda as
  // limpezas na ordem dos efeitos, então esta marca a saída primeiro.
  const saindoRef = useRef(false);
  useEffect(() => {
    saindoRef.current = false;
    return () => {
      saindoRef.current = true;
    };
  }, []);

  // Resultado parado por 2 s: grava. Qualquer mudança reinicia a espera.
  // Saiu da tela no meio da espera: grava na hora o que estava parado na tela.
  // Mudança que deixa o resultado inválido só cancela (não grava preço inválido).
  useEffect(() => {
    if (!segueGravando || !pronto || !userId) return;
    if (produtoIdRef.current && chave === ultimaGravadaRef.current) return;
    let disparou = false;
    const t = setTimeout(() => {
      disparou = true;
      void gravar();
    }, PAUSA_PRIMEIRO_PRECO_MS);
    return () => {
      clearTimeout(t);
      if (saindoRef.current && !disparou) void gravar();
    };
  }, [segueGravando, pronto, userId, chave, gravar]);

  /** Grava o nome digitado (ao sair do campo ou no Enter). Sem produto ainda, vai no insert. */
  const salvarNome = useCallback(async (): Promise<boolean> => {
    const id = produtoIdRef.current;
    if (!id) return false;
    const nomeFinal = nomeParaGuardar(nomeRef.current, valoresRef.current.perfil);
    const { error } = await supabase
      .from("produtos")
      .update({ nome: nomeFinal, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      console.error("primeiro_preco_nome", error);
      setErroNome(
        "A Pólia One não conseguiu trocar o nome agora. Tenta de novo, o nome continua no campo.",
      );
      return false;
    }
    setErroNome(null);
    onCriadoRef.current?.();
    return true;
  }, []);

  const tentarDeNovo = useCallback(() => {
    ultimaGravadaRef.current = null;
    void gravar();
  }, [gravar]);

  return { estado, erro, erroNome, produtoId, nome, setNome, salvarNome, tentarDeNovo };
}
