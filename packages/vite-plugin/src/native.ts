// testing single file logic via https://github.com/richardtallent/vite-plugin-singlefile

// helpful:
// rollup config for react native
// https://gist.github.com/pritishvaidya/171dcb8e857ec1df186c035c3df6ae16

import { esbuildFlowPlugin } from '@bunchtogether/vite-plugin-flow'
import { esbuildCommonjs } from '@originjs/vite-plugin-commonjs'
import rollupCommonJs from '@rollup/plugin-commonjs'
import flowRemoveTypes from 'flow-remove-types'
import micromatch from 'micromatch'
import { OutputAsset, OutputChunk, OutputOptions } from 'rollup'
import { Plugin } from 'vite'

export function replaceScript(
  html: string,
  scriptFilename: string,
  scriptCode: string,
  removeViteModuleLoader = false
): string {
  const reScript = new RegExp(
    `<script([^>]*?) src="[./]*${scriptFilename}"([^>]*)></script>`
  )
  // we can't use String.prototype.replaceAll since it isn't supported in Node.JS 14
  const preloadMarker = /"__VITE_PRELOAD__"/g
  const newCode = scriptCode.replace(preloadMarker, 'void 0')
  const inlined = html.replace(
    reScript,
    (_, beforeSrc, afterSrc) => `<script${beforeSrc}${afterSrc}>\n${newCode}\n</script>`
  )
  return removeViteModuleLoader ? _removeViteModuleLoader(inlined) : inlined
}

export function replaceCss(
  html: string,
  scriptFilename: string,
  scriptCode: string
): string {
  const reCss = new RegExp(`<link[^>]*? href="[./]*${scriptFilename}"[^>]*?>`)
  const inlined = html.replace(reCss, `<style>\n${scriptCode}\n</style>`)
  return inlined
}

const warnNotInlined = (filename: string) =>
  console.warn(`WARNING: asset not inlined: ${filename}`)

export function nativePlugin(): Plugin {
  return {
    name: 'vite:singlefile',

    config: (config) => {
      if (!config.build) config.build = {}

      config.build.modulePreload = { polyfill: false }
      // Ensures that even very large assets are inlined in your JavaScript.
      config.build.assetsInlineLimit = 100000000
      // Avoid warnings about large chunks.
      config.build.chunkSizeWarningLimit = 100000000
      // Emit all CSS as a single file, which `vite-plugin-singlefile` can then inline.
      config.build.cssCodeSplit = false
      // Avoids the extra step of testing Brotli compression, which isn't really pertinent to a file served locally.
      config.build.reportCompressedSize = false
      // Subfolder bases are not supported, and shouldn't be needed because we're embedding everything.
      config.base = undefined

      const extensions = [
        '.ios.js',
        '.native.js',
        '.native.ts',
        '.native.tsx',
        '.js',
        '.jsx',
        '.json',
        '.ts',
        '.tsx',
        '.mjs',
      ]

      config.resolve ??= {}

      config.resolve.extensions = extensions

      config.resolve.alias ??= {}
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-native/Libraries/Renderer/shims/ReactFabric':
          'react-native/Libraries/Renderer/shims/ReactFabric',
        'react-native/Libraries/Utilities/codegenNativeComponent':
          'react-native/Libraries/Utilities/codegenNativeComponent',
        'react-native-svg': 'react-native-svg',
        'react-native-web': 'react-native',
        'react-native': 'react-native',
      }

      config.optimizeDeps ??= {}
      config.optimizeDeps.esbuildOptions ??= {}
      config.optimizeDeps.esbuildOptions.resolveExtensions = extensions

      config.optimizeDeps.esbuildOptions.plugins ??= []
      config.optimizeDeps.esbuildOptions.plugins.push(
        esbuildFlowPlugin(
          /node_modules\/(react-native\/|@react-native\/assets)/,
          (_) => 'jsx'
        )
      )
      config.optimizeDeps.esbuildOptions.plugins.push(esbuildCommonjs(['react-native']))

      config.optimizeDeps.esbuildOptions.plugins.push({
        name: `testing`,
        setup(build) {
          build.onResolve(
            {
              filter: /\react-native\//,
            },
            async ({ path, namespace }) => {
              console.log('rn?', path)
              return {
                path: '',
                external: true,
              }
            }
          )
        },
      })

      config.optimizeDeps.include ??= []
      config.optimizeDeps.include.push('react-native')

      config.optimizeDeps.esbuildOptions.loader ??= {}
      config.optimizeDeps.esbuildOptions.loader['.js'] = 'jsx'

      config.optimizeDeps.esbuildOptions.plugins.push({
        name: 'react-native-assets',
        setup(build) {
          build.onResolve(
            {
              filter: /\.(png|jpg|gif|webp)$/,
            },
            async ({ path, namespace }) => {
              return {
                path: '',
                external: true,
              }
            }
          )
        },
      })

      config.build.rollupOptions ??= {}

      config.build.rollupOptions.input =
        '/Users/n8/tamagui/apps/kitchen-sink/src/index.tsx'

      config.build.rollupOptions.output ??= {}

      config.build.rollupOptions.plugins ??= []

      console.log('wtf', config.build.rollupOptions.plugins)

      if (Array.isArray(config.build.rollupOptions.plugins)) {
        config.build.rollupOptions.plugins.push({
          name: `??`,

          resolveId: {
            order: 'pre',
            handler(source) {
              if (source === 'react-native' || source.startsWith('react-native/')) {
                return { id: source, external: true }
              }
              return null
            },
          },

          // load(id) {
          //   console.log('load', id)
          //   if (id.includes('/react-native/')) {
          //     // const transformed = flowRemoveTypes(code, {})
          //     // return { code: transformed.toString(), map: transformed.generateMap() }
          //   }
          // },

          // transform(code, id) {
          //   // somehow disablinfg index.html with this fixes things?
          //   console.log('hi', id)
          //   // const transformed = flowRemoveTypes(code, {})
          //   // return { code: transformed.toString(), map: transformed.generateMap() }
          //   return {
          //     code,
          //     map: null as any,
          //   }
          // },
        })

        // config.build.rollupOptions.plugins.push(rollupCommonJs())
        // config.build.rollupOptions.plugins.push(viteCommonjs())
      }

      const updateOutputOptions = (out: OutputOptions) => {
        // Ensure that as many resources as possible are inlined.
        out.inlineDynamicImports = true

        // added by me (nate):
        console.log('adding manualChunks = undefined')
        out.manualChunks = undefined
      }

      if (Array.isArray(config.build.rollupOptions.output)) {
        for (const o in config.build.rollupOptions.output)
          updateOutputOptions(o as OutputOptions)
      } else {
        updateOutputOptions(config.build.rollupOptions.output as OutputOptions)
      }
    },

    enforce: 'post',

    generateBundle: (_, bundle) => {
      const inlinePattern = []
      const jsExtensionTest = /\.[mc]?js$/
      const htmlFiles = Object.keys(bundle).filter((i) => i.endsWith('.html'))
      const cssAssets = Object.keys(bundle).filter((i) => i.endsWith('.css'))
      const jsAssets = Object.keys(bundle).filter((i) => jsExtensionTest.test(i))
      const bundlesToDelete = [] as string[]

      console.log('bundle', bundle)

      // for (const name of htmlFiles) {
      //   const htmlChunk = bundle[name] as OutputAsset
      //   let replacedHtml = htmlChunk.source as string
      //   for (const jsName of jsAssets) {
      //     if (!inlinePattern.length || micromatch.isMatch(jsName, inlinePattern)) {
      //       const jsChunk = bundle[jsName] as OutputChunk
      //       if (jsChunk.code != null) {
      //         bundlesToDelete.push(jsName)
      //         replacedHtml = replaceScript(
      //           replacedHtml,
      //           jsChunk.fileName,
      //           jsChunk.code,
      //           false
      //           // removeViteModuleLoader
      //         )
      //       }
      //     } else {
      //       warnNotInlined(jsName)
      //     }
      //   }
      //   for (const cssName of cssAssets) {
      //     if (!inlinePattern.length || micromatch.isMatch(cssName, inlinePattern)) {
      //       const cssChunk = bundle[cssName] as OutputAsset
      //       bundlesToDelete.push(cssName)
      //       replacedHtml = replaceCss(
      //         replacedHtml,
      //         cssChunk.fileName,
      //         cssChunk.source as string
      //       )
      //     } else {
      //       warnNotInlined(cssName)
      //     }
      //   }
      //   htmlChunk.source = replacedHtml
      // }

      // if (deleteInlinedFiles) {
      //   for (const name of bundlesToDelete) {
      //     delete bundle[name]
      //   }
      // }

      // for (const name of Object.keys(bundle).filter(
      //   (i) => !jsExtensionTest.test(i) && !i.endsWith('.css') && !i.endsWith('.html')
      // )) {
      //   warnNotInlined(name)
      // }
    },
  }
}

// Optionally remove the Vite module loader since it's no longer needed because this plugin has inlined all code.
// This assumes that the Module Loader is (1) the FIRST function declared in the module, (2) an IIFE, (3) is minified,
// (4) is within a script with no unexpected attribute values, and (5) that the containing script is the first script
// tag that matches the above criteria. Changes to the SCRIPT tag especially could break this again in the future.
// Update example:
// https://github.com/richardtallent/vite-plugin-singlefile/issues/57#issuecomment-1263950209
const _removeViteModuleLoader = (html: string) =>
  html.replace(
    /(<script type="module" crossorigin>\s*)\(function\(\)\{[\s\S]*?\}\)\(\);/,
    '<script type="module">\n'
  )
