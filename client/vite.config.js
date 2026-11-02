import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const clientDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, clientDirectory, '');
  if (mode !== 'development') {
    if (!env.VITE_SERVER_URL) {
      throw new Error('Define VITE_SERVER_URL para compilar el cliente de producción.');
    }
    return {};
  }

  const host = env.VITE_CLIENT_HOST;
  if (!host) throw new Error('Define VITE_CLIENT_HOST en client/.env para iniciar Vite.');
  const port = Number(env.VITE_CLIENT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Define VITE_CLIENT_PORT en client/.env para iniciar Vite.');
  }

  return {
    server: { host, port, strictPort: true }
  };
});
