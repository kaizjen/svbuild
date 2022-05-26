/**
 * @type {import('../config').Config}
 */
const config = {
  src: './svelte',
  out: './out',
  compilerOptions: {
    esm: true,
    dev: true,
    sveltePath: './out/m/svelte'
  },
  moduleOptions: {
    root: './out/m',
    buildModules: true,
    buildSvelte: true,
    modulesSrc: 'node_modules'
  }
}

export default config