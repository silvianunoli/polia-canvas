// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Force-enable Nitro for builds rodando fora do sandbox Lovable.
  // Sem isso, o Lovable plugin pula o Nitro e a build deixa deps como `h3-v2`
  // como bare imports — o Worker quebra com "No such module" no runtime.
  //
  // cloudflare.wrangler.assets: sem isso, refresh numa rota SSR que não é
  // arquivo estático (ex. /admin/negocio) recebe 404 direto do asset server
  // do Cloudflare, sem nem rodar o Worker — só corrige depois que o JS do
  // client hidrata e o router client-side resolve a rota de verdade.
  // run_worker_first manda a requisição pro Worker (SSR de verdade) antes de
  // checar asset estático. Editar isso direto no wrangler.jsonc não funciona
  // (Nitro sobrescreve "assets" e ignora, com aviso) — precisa entrar aqui,
  // em nitro.cloudflare.wrangler, que o preset cloudflare_module do Nitro
  // funde no dist/server/wrangler.json gerado. `wrangler` funciona em
  // runtime (Nitro faz spread de tudo que vier em nitro.cloudflare) mas não
  // está no tipo estreito que @lovable.dev/vite-tanstack-config expõe de
  // propósito — daí o cast.
  nitro: {
    cloudflare: {
      wrangler: {
        assets: {
          not_found_handling: "single-page-application",
          run_worker_first: true,
        },
      },
    } as { nodeCompat?: boolean; deployConfig?: boolean },
  },
});
