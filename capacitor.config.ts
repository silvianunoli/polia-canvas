import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.usepolia.app',
  appName: 'Pólia',
  webDir: 'dist/client',
  server: {
    url: 'https://usepolia.com.br',
    androidScheme: 'https'
  }
};

export default config;
