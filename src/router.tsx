import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { paraDentro, paraFora } from "@/lib/lojaDominio";
import { lojaDoDominio } from "@/lib/lojaDoDominio";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Vitrine online no domínio próprio da marca (ONE-221): "/" do domínio é a
  // rota /loja/<endereço>, e os links saem sem esse pedaço.
  const loja = lojaDoDominio();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(loja
      ? {
          rewrite: {
            input: ({ url }: { url: URL }) => {
              url.pathname = paraDentro(url.pathname, loja.slug);
              return url;
            },
            output: ({ url }: { url: URL }) => {
              url.pathname = paraFora(url.pathname, loja.slug);
              return url;
            },
          },
        }
      : {}),
  });

  return router;
};
