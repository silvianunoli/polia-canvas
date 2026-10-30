import { Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useTurnstile } from "@/hooks/useTurnstile";
import { reais } from "@/lib/loja";
import { enviarPedidoLoja } from "@/lib/loja.functions";
import {
  linkWhatsapp,
  mascararCep,
  mascararWhatsapp,
  mensagemDoErroPedido,
  montarPedido,
  soDigitos,
  validarCheckout,
  type CampoCheckout,
} from "@/lib/lojaVitrine";
import { IconeWhatsapp, SemFoto } from "./icones";
import { useLojaVitrine } from "./LojaContexto";

// Janela do carrinho (dialog nativo, modal: prende o foco e fecha no Esc)
// com o checkout e o passo "Pedido recebido". O pedido vai pra loja pelo
// enviarPedidoLoja; o WhatsApp é o segundo passo, pra combinar pagamento.

const ORDEM_DOS_CAMPOS: CampoCheckout[] = ["nome", "whatsapp", "cep", "rua", "numero", "cidade", "uf", "presentePara"];

export function CarrinhoDialog() {
  const { aberto, fecharCarrinho, itens, concluido } = useLojaVitrine();
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
    if (!aberto && d.open) d.close();
  }, [aberto]);

  const titulo = concluido ? "Pedido recebido" : "Seu carrinho";

  return (
    <dialog
      ref={ref}
      className="carrinho"
      aria-labelledby={tituloId}
      onClose={fecharCarrinho}
      onClick={(e) => {
        if (e.target === e.currentTarget) fecharCarrinho();
      }}
    >
      {aberto && (
        <>
          <div className="topo">
            <h2 id={tituloId}>{titulo}</h2>
            <button type="button" className="fechar" aria-label="Fechar o carrinho" onClick={fecharCarrinho}>
              <X aria-hidden="true" />
            </button>
          </div>
          {concluido ? <PedidoRecebido /> : itens.length ? <Checkout /> : <CarrinhoVazio />}
        </>
      )}
    </dialog>
  );
}

function CarrinhoVazio() {
  const { loja, fecharCarrinho } = useLojaVitrine();
  return (
    <div className="corpo">
      <p className="vazio">O carrinho está vazio. Escolha uma peça e ela aparece aqui.</p>
      <Link to="/loja/$slug" params={{ slug: loja.slug }} hash="produtos" className="btn sec" onClick={fecharCarrinho}>
        Ver os produtos
      </Link>
    </div>
  );
}

function Campo({
  id,
  rotulo,
  erro,
  dica,
  opcional,
  className,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: ReactNode;
  opcional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`campo${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>
        {rotulo}
        {opcional && <span className="opcional"> (opcional)</span>}
      </label>
      {children}
      {dica}
      {erro && (
        <span id={`${id}-erro`} className="erro-campo">
          {erro}
        </span>
      )}
    </div>
  );
}

function Checkout() {
  const { loja, itens, linhas, resumo, mudar, dados, mudarDados, idDoEnvio, concluir } = useLojaVitrine();
  const ts = useTurnstile();
  const hpRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const idDe = (c: CampoCheckout | "obs" | "presente") => `${uid}-${c}`;
  const dicaId = `${uid}-dica`;

  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState("");
  const cepBuscado = useRef("");

  const erros = tentou ? validarCheckout(dados, loja.pedeEndereco) : {};
  const attrs = (c: CampoCheckout) => ({
    id: idDe(c),
    "aria-invalid": erros[c] ? true : undefined,
    "aria-describedby": erros[c] ? `${idDe(c)}-erro` : undefined,
  });

  // CEP completo: o ViaCEP preenche rua, bairro, cidade e UF. Falhou, a
  // cliente preenche à mão; nada trava.
  const cepDigitos = soDigitos(dados.cep);
  useEffect(() => {
    if (!loja.pedeEndereco || cepDigitos.length !== 8 || cepBuscado.current === cepDigitos) return;
    cepBuscado.current = cepDigitos;
    const parar = new AbortController();
    setCepStatus("Buscando o endereço…");
    fetch(`https://viacep.com.br/ws/${cepDigitos}/json/`, { signal: parar.signal })
      .then((r) => r.json() as Promise<{ erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }>)
      .then((j) => {
        if (j.erro) {
          setCepStatus("CEP não encontrado. Preencha o endereço à mão.");
          return;
        }
        mudarDados({
          ...(j.logradouro ? { rua: j.logradouro } : {}),
          ...(j.bairro ? { bairro: j.bairro } : {}),
          ...(j.localidade ? { cidade: j.localidade } : {}),
          ...(j.uf ? { uf: j.uf } : {}),
        });
        setCepStatus(j.logradouro ? "Endereço encontrado. Falta o número." : "Cidade encontrada. Complete a rua e o número.");
        document.getElementById(idDe(j.logradouro ? "numero" : "rua"))?.focus();
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        cepBuscado.current = "";
        setCepStatus("Não deu pra buscar o CEP agora. Preencha o endereço à mão.");
      });
    return () => parar.abort();
    // idDe depende só do uid, estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepDigitos, loja.pedeEndereco, mudarDados]);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setTentou(true);
    const v = validarCheckout(dados, loja.pedeEndereco);
    const primeiro = ORDEM_DOS_CAMPOS.find((c) => v[c]);
    if (primeiro) {
      setErro(null);
      document.getElementById(idDe(primeiro))?.focus();
      return;
    }
    if (!ts.token) {
      setErro("Confirme a verificação anti-robô acima pra liberar o pedido.");
      return;
    }
    const corpo = montarPedido(loja.slug, itens, dados, loja.pedeEndereco);
    const id = idDoEnvio(corpo);
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarPedidoLoja({
        data: { ...corpo, id, turnstileToken: ts.token, hp: hpRef.current?.value || undefined },
      });
      if (r.ok) {
        concluir();
        return;
      }
      ts.reset();
      setErro(mensagemDoErroPedido(r.motivo));
    } catch {
      ts.reset();
      setErro(mensagemDoErroPedido("rede"));
    } finally {
      setEnviando(false);
    }
  };

  const esperandoVerificacao = !ts.token && !ts.erroCarregamento;

  return (
    <form className="conteudo" onSubmit={(e) => void confirmar(e)} noValidate>
      <div className="corpo">
        <ul className="itens" aria-label="Itens do carrinho">
          {linhas.map((l, k) => (
            <li key={`${l.produtoId}-${l.skuId ?? ""}`}>
              <span className="mini">{l.produto.fotos[0] ? <img src={l.produto.fotos[0]} alt="" /> : <SemFoto />}</span>
              <div className="it">
                <b>{l.produto.nome}</b>
                {l.variacaoNome && <span>{l.variacaoNome}</span>}
                <span>{reais(l.produto.preco)} cada</span>
                <div className="qtd">
                  <button
                    type="button"
                    aria-label={`Uma a menos de ${l.produto.nome}`}
                    onClick={() => mudar(k, l.quantidade - 1)}
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <span className="n" aria-live="polite">
                    {l.quantidade}
                  </span>
                  <button
                    type="button"
                    aria-label={`Uma a mais de ${l.produto.nome}`}
                    onClick={() => mudar(k, l.quantidade + 1)}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                  <button type="button" className="tirar" onClick={() => mudar(k, 0)}>
                    Tirar
                  </button>
                </div>
              </div>
              <b className="vl">{reais(l.total)}</b>
            </li>
          ))}
        </ul>

        <Campo id={idDe("obs")} rotulo="Observações do pedido" opcional>
          <textarea
            id={idDe("obs")}
            rows={2}
            maxLength={400}
            value={dados.observacao}
            placeholder="Alguma preferência de cor, tamanho ou data?"
            onChange={(e) => mudarDados({ observacao: e.target.value })}
          />
        </Campo>

        {loja.entregaTexto && (
          <p className="info-entrega">
            <b>Entrega</b>
            <small>{loja.entregaTexto}</small>
          </p>
        )}

        <div className="resumo" aria-label="Resumo do pedido">
          <div>
            <span>Subtotal</span>
            <span>{reais(resumo.subtotal)}</span>
          </div>
          <div>
            <span>Frete</span>
            <span>a combinar</span>
          </div>
          <div className="total">
            <span>Total</span>
            <span>{reais(resumo.subtotal)} + frete</span>
          </div>
          {resumo.sinal > 0 && (
            <div className="sinal">
              <span>Sinal de {loja.sinalPercentual}% pra começar</span>
              <span>{reais(resumo.sinal)}</span>
            </div>
          )}
        </div>

        <h3 className="tit-dados">Seus dados</h3>
        <div className="form">
          <Campo id={idDe("nome")} rotulo="Nome completo" erro={erros.nome}>
            <input
              {...attrs("nome")}
              autoComplete="name"
              maxLength={120}
              value={dados.nome}
              onChange={(e) => mudarDados({ nome: e.target.value })}
            />
          </Campo>
          <Campo id={idDe("whatsapp")} rotulo="WhatsApp com DDD" erro={erros.whatsapp}>
            <input
              {...attrs("whatsapp")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 98888-0000"
              maxLength={16}
              value={dados.whatsapp}
              onChange={(e) => mudarDados({ whatsapp: mascararWhatsapp(e.target.value) })}
            />
          </Campo>

          {loja.pedeEndereco && (
            <fieldset className="endereco">
              <legend className="tit-dados">Endereço de entrega</legend>
              <Campo
                id={idDe("cep")}
                rotulo="CEP"
                erro={erros.cep}
                dica={
                  cepStatus ? (
                    <small aria-live="polite">{cepStatus}</small>
                  ) : (
                    <small aria-live="polite">O endereço se preenche sozinho pelo CEP.</small>
                  )
                }
              >
                <input
                  {...attrs("cep")}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  maxLength={9}
                  value={dados.cep}
                  onChange={(e) => mudarDados({ cep: mascararCep(e.target.value) })}
                />
              </Campo>
              <Campo id={idDe("rua")} rotulo="Rua" erro={erros.rua}>
                <input
                  {...attrs("rua")}
                  autoComplete="address-line1"
                  maxLength={120}
                  value={dados.rua}
                  onChange={(e) => mudarDados({ rua: e.target.value })}
                />
              </Campo>
              <div className="linha2">
                <Campo id={idDe("numero")} rotulo="Número" erro={erros.numero}>
                  <input
                    {...attrs("numero")}
                    maxLength={20}
                    value={dados.numero}
                    onChange={(e) => mudarDados({ numero: e.target.value })}
                  />
                </Campo>
                <Campo id={idDe("complemento")} rotulo="Complemento" opcional>
                  <input
                    id={idDe("complemento")}
                    autoComplete="address-line2"
                    placeholder="Apto, bloco"
                    maxLength={60}
                    value={dados.complemento}
                    onChange={(e) => mudarDados({ complemento: e.target.value })}
                  />
                </Campo>
              </div>
              <Campo id={idDe("bairro")} rotulo="Bairro" opcional>
                <input
                  id={idDe("bairro")}
                  maxLength={80}
                  value={dados.bairro}
                  onChange={(e) => mudarDados({ bairro: e.target.value })}
                />
              </Campo>
              <div className="linha2 cidade-uf">
                <Campo id={idDe("cidade")} rotulo="Cidade" erro={erros.cidade}>
                  <input
                    {...attrs("cidade")}
                    autoComplete="address-level2"
                    maxLength={80}
                    value={dados.cidade}
                    onChange={(e) => mudarDados({ cidade: e.target.value })}
                  />
                </Campo>
                <Campo id={idDe("uf")} rotulo="UF" erro={erros.uf}>
                  <input
                    {...attrs("uf")}
                    autoComplete="address-level1"
                    maxLength={2}
                    value={dados.uf}
                    onChange={(e) => mudarDados({ uf: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase() })}
                  />
                </Campo>
              </div>
            </fieldset>
          )}

          <label className="opcao" htmlFor={idDe("presente")}>
            <input
              id={idDe("presente")}
              type="checkbox"
              checked={dados.presente}
              onChange={(e) => mudarDados({ presente: e.target.checked })}
            />
            <span>
              <b>É presente pra outra pessoa?</b>
              <small>A loja prepara em nome de quem vai receber.</small>
            </span>
          </label>
          {dados.presente && (
            <Campo id={idDe("presentePara")} rotulo="Nome de quem vai receber" erro={erros.presentePara}>
              <input
                {...attrs("presentePara")}
                maxLength={120}
                value={dados.presentePara}
                onChange={(e) => mudarDados({ presentePara: e.target.value })}
              />
            </Campo>
          )}

          {/* Campo-isca: invisível, fora da tabulação, nome que o
              preenchimento automático não reconhece. Robô preenche, gente não. */}
          <input
            ref={hpRef}
            type="text"
            name="hp_loja_x"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="isca"
          />

          <TurnstileWidget containerRef={ts.containerRef} />
          {ts.erroCarregamento && (
            <p className="erro">
              A verificação anti-robô não carregou. Desligue o bloqueador de anúncios desta página ou abra em outro
              navegador.
            </p>
          )}
          <p className="dica">
            Seu nome, WhatsApp e endereço vão só pra {loja.nome}, que recebe o pedido pela Pólia One.{" "}
            <Link to="/privacidade" target="_blank" rel="noopener">
              Política de privacidade
            </Link>
          </p>
        </div>
      </div>

      <div className="pe">
        {erro && (
          <p role="alert" className="erro">
            {erro}
          </p>
        )}
        <button
          type="submit"
          className="btn"
          disabled={enviando || !ts.token}
          aria-describedby={esperandoVerificacao ? dicaId : undefined}
        >
          {enviando ? "Enviando o pedido…" : `Confirmar pedido · ${reais(resumo.subtotal)}`}
        </button>
        {esperandoVerificacao && (
          <p id={dicaId} className="dica">
            Confirme a caixa anti-robô acima pra liberar o botão.
          </p>
        )}
      </div>
    </form>
  );
}

/** Mensagem com *negrito* do WhatsApp mostrada em negrito de verdade, sem HTML cru. */
function MensagemFormatada({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  return (
    <pre className="msg">
      {partes.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <b key={i}>{p.slice(1, -1)}</b> : p))}
    </pre>
  );
}

function PedidoRecebido() {
  const { loja, concluido, novoPedido } = useLojaVitrine();
  const [copia, setCopia] = useState("");
  if (!concluido) return null;
  const link = linkWhatsapp(loja.whatsapp, concluido.mensagem);
  const nome = concluido.primeiroNome;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(concluido.mensagem);
      setCopia("Mensagem copiada.");
    } catch {
      setCopia("Não deu pra copiar. Selecione o texto e copie.");
    }
  };

  return (
    <div className="corpo enviar">
      <p className="quase">{nome ? `Quase lá, ${nome}.` : "Quase lá."}</p>
      <p>
        O pedido já chegou na loja {loja.nome}.{" "}
        {link
          ? "Agora mande a mensagem abaixo no WhatsApp da loja pra combinar o pagamento e a entrega."
          : "A loja confirma os detalhes com você pelo WhatsApp que você deixou."}
      </p>
      <MensagemFormatada texto={concluido.mensagem} />
      {link && (
        <a className="btn zap" href={link} target="_blank" rel="noopener">
          <IconeWhatsapp />
          <span>Mandar o pedido no WhatsApp</span>
        </a>
      )}
      <button type="button" className="btn sec" onClick={() => void copiar()}>
        Copiar mensagem
      </button>
      <p className="dica" role="status">
        {copia}
      </p>
      <button type="button" className="link" onClick={novoPedido}>
        Fazer outro pedido
      </button>
    </div>
  );
}
