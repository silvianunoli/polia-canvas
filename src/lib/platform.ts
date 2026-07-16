import { Capacitor } from "@capacitor/core";

// App Android/iOS embrulhado em Capacitor: quem já baixou o app decidiu usar
// a Pólia, então as páginas de marketing do site (landing, preços, sobre...)
// não fazem sentido aqui dentro — o guard de rota manda direto pro painel/login.
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}
