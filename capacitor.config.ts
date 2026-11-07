import type { CapacitorConfig } from "@capacitor/cli";

// Fundo pedra (--bg de src/styles.css): cor da abertura e da WebView enquanto
// a primeira página carrega, no lugar da tela preta (AND-10).
const PEDRA = "#F2F0ED";

const config: CapacitorConfig = {
  appId: "br.com.usepolia.app",
  appName: "Pólia One",
  webDir: "dist/client",
  backgroundColor: PEDRA,
  server: {
    // O app abre na tela de entrada própria (/app), não na home de marketing.
    url: "https://one.usepolia.com.br/app",
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      // A página tira a abertura quando pinta (esconderAberturaDoApp); os 3 s
      // são o teto, pra ela nunca ficar presa sem internet.
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: PEDRA,
      showSpinner: false,
    },
  },
};

export default config;
