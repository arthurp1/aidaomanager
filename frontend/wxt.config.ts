import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'AI DAO Manager',
    description: 'AI-powered development assistant that helps you manage tasks, track time, and boost productivity',
    version: '1.0.0'
  }
});
