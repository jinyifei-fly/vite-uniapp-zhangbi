import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import postcss from './postcss.config.js'
import plugins from './vite.config.plugins.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    base: './',

    server: {
      port: 1045,
      cors: true,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET_URL,
          changeOrigin: true,
          secure: false,

          rewrite: path => path,
        },
      },
    },

    resolve: {
      alias: {
        '@': path.resolve('./src'),
        '@root': path.resolve('./'),
      },
    },

    css: {
      postcss,
    },

    define: {
      'process.env': env,
    },

    plugins: plugins({ env }),
  }
})
