/// <reference types="vitest" />
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import vitePluginImp from 'vite-plugin-imp'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

import { default as js } from '../turbo.json'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Frontend env vars live in `turbo.json` to ensure the build is not cached.
// Adding something here? Please update `.env.d.ts` to update our Typescript definitions.
// *DO NOT* put something in here unless you're positive it's safe to expose this to the world.
const ENVVAR_ALLOWLIST = js.pipeline.build.env

// In order to prevent accidentally env var leakage, Vite only allows the configuration of defining
// the environment variable prefix (see: https://vitejs.dev/guide/env-and-mode.html#env-variables-and-modes)
// This piece of code allows us to define an allowlist (see above) into the prefix system but ensures only
// the env vars on the allowlist are actually exposed.
const validateSafeAllowList = (env: Record<string, string>) => {
	ENVVAR_ALLOWLIST.forEach((allowListEnvVar) => {
		Object.keys(env).forEach((key) => {
			if (key === allowListEnvVar) {
				return
			}

			if (key.startsWith(allowListEnvVar)) {
				const error = `

ENVVAR_ALLOWLIST is not safe because ${key} would match the prefix of ${allowListEnvVar}
Rename ${key} to something such that "${key}".startsWith("${allowListEnvVar}") returns false.
`
				throw new Error(error)
			}
		})
	})
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '')
	validateSafeAllowList(env)

	console.log('DEFINED SOMETHING')
	console.log(mode)
	return {
		plugins: [
			react(),
			vanillaExtractPlugin(),
			tsconfigPaths(),
			svgr(),
			vitePluginImp({
				// Seems to result in this error:
				// > Rollup failed to resolve import "lodash/default" from "src/pages/Player/PlayerHook/PlayerHook.tsx"
				// Likely due to some custom resolution algorithm that doesn't support hoisted monorepos?
				exclude: ['lodash'],
				libList: [
					{
						libName: 'antd',
						style: (name) => `antd/es/${name}/style/index.js`,
					},
					// TODO: enable this later to reduce bundle size
					// {
					// 	libName: 'lodash',
					// 	libDirectory: '',
					// 	camel2DashComponentName: false,
					// },
				],
			}),
		],
		envPrefix: ['VITE_', ...ENVVAR_ALLOWLIST],
		server: {
			host: '0.0.0.0',
			port: 3000,
			https: {
				key: join(__dirname, '../backend/localhostssl/server.key'),
				cert: join(__dirname, '../backend/localhostssl/server.crt'),
			},
			// ensure hmr works when proxying frontend
			strictPort: true,
			hmr: {
				clientPort: 3000,
			},
			watch: {
				ignored: ['**/node_modules/**', '**/src/__generated/**'],
			},
		},
		build: {
			minify: 'esbuild',
			outDir: 'build',
			// Vite sourcemaps are broken in development
			// https://github.com/highlight-run/highlight/pull/3171
			sourcemap: env.RENDER_PREVIEW !== 'true' && mode !== 'development',
			rollupOptions: {
				output: {
					manualChunks: (id: string) => {
						if (id.endsWith('frontend/src/constants.ts')) {
							return 'constants'
						}
						return null
					},
					entryFileNames: `assets/[name].js`,
					chunkFileNames: `assets/[name].js`,
					assetFileNames: `assets/[name].[ext]`,
				},
			},
		},
		test: {
			globals: true,
			environment: 'happy-dom',
			setupFiles: ['./src/setupTests.ts'],
		},
		css: {
			devSourcemap: true,
			preprocessorOptions: {
				less: {
					javascriptEnabled: true,
					modifyVars: {
						hack: `true; @import "${join(
							__dirname,
							'src/style/AntDesign/antd.overrides.less',
						)}";`,
					},
				},
			},
		},
	}
})
