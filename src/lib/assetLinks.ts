// Digital Asset Links (AND-09): prova pro Android que o app br.com.usepolia.app
// é dono de https://one.usepolia.com.br, e por isso o link de e-mail
// (/auth/link) abre direto no app. Servido em /.well-known/assetlinks.json pelo
// src/server.ts, antes do roteamento.
//
// Impressão digital SHA-256 do certificado que assina o app (é pública, não é
// segredo). Hoje o app é assinado com a chave de teste (debug.keystore) da
// máquina da Sil. Quando for pra Play Store, entra também a da chave de
// publicação (Play Console > Integridade do app > Assinatura de apps), sem tirar
// esta enquanto houver app de teste instalado.
export const IMPRESSOES_DIGITAIS_DO_APP = [
  "80:BD:ED:6A:8D:1B:B5:80:3C:DC:7E:F9:47:CB:C9:A3:C2:3A:7E:34:6C:5D:23:84:58:15:BF:55:A5:42:C4:39",
];

export const PACOTE_DO_APP = "br.com.usepolia.app";

export function corpoAssetLinks(): string {
  return JSON.stringify([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACOTE_DO_APP,
        sha256_cert_fingerprints: IMPRESSOES_DIGITAIS_DO_APP,
      },
    },
  ]);
}
