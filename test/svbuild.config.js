import sveltePreprocess from "svelte-preprocess";
/**
 * @type {import('svbuild/types').Config}
 */
const config = {
  src: './svelte',
  out: './out',
  compilerOptions: {
    esm: true,
    dev: true,
    sveltePath: './out/m/svelte'
  },
  preprocess: sveltePreprocess({
    typescript: {}
  }),
  moduleOptions: {
    root: 'm',
    buildModules: true,
    buildSvelte: true,
    modulesSrc: 'node_modules'
  }
}

export default config