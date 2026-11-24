// Digital Asset Links (AND-09): prova pro Android que o app br.com.usepolia.app
// é dono de https://one.usepolia.com.br, e por isso o link de e-mail
// (/auth/link) abre direto no app. Servido em /.well-known/assetlinks.json pelo
// src/server.ts, antes do roteamento.
//
// Impressões digitais SHA-256 dos certificados que assinam o app (são públicas,
// não são segredo). A primeira é a chave de teste (debug.keystore) da máquina da
// Sil; a segunda é a chave de envio pra Play (polia-upload, AND-01), que assina o
// APK de release instalado à mão. Quando o app entrar na Play Store, entra também
// a da chave de assinatura da Play (Play Console > Integridade do app >
// Assinatura de apps), sem tirar estas enquanto houver APK instalado à mão.
export const IMPRESSOES_DIGITAIS_DO_APP = [
  "80:BD:ED:6A:8D:1B:B5:80:3C:DC:7E:F9:47:CB:C9:A3:C2:3A:7E:34:6C:5D:23:84:58:15:BF:55:A5:42:C4:39",
  "E3:17:30:8A:3E:71:83:87:51:1E:8C:BB:05:43:52:43:FE:36:C0:29:22:E1:37:D9:AE:7E:BE:99:EE:DB:62:4A",
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
