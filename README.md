# svbuild

>  A simple tool that builds your svelte files without bundling them.

## Why

Sometimes, bundlers are a bit too much. They have a lot of configuration and the output they produce is sometimes unnecessary. For example, when you're building an embedded application in CEF or in Electron, you know for a fact that latest js features are supported. This is a tool that will build your dependencies for svelte and produce browser-friendly imports: `import { onMount } from "svelte"` becomes `import { onMount } from "../modules/svelte/index.mjs"`.

This tool is **not** for making web apps. For that, use `SvelteKit` or a bundler.

## Getting started

- Install svbuild globally by running `npm i svbuild -g` or locally (not recommended): `npm i svbuild -D`

- Create a folder with two subfolders: `/src` and `/out`.

- In the root of this folder place a `package.json` with `"type": "module"`.

- In the root also create a file called `svlc.config.js`. What to write in it is explained below.

- Write your svelte code in the src dir.

- Run `svbuild`.

- Enjoy.

## Configuration

All configuration is in the `svlc.config.js`.

This is the type for the config file:

```ts
export type Config = {
  /** Path to source directory with svelte code */
  src: string,
  /** Path to output directory */
  out: string,
  /** Svelte compiler options */
  compilerOptions?: {
    /** Whether to generate code with ES6 imports and exports Note that svbuild doesn't provide a `require()` funtion! */
    esm?: boolean,
    /** Developer mode */
    dev?: boolean,
    /** Path to the svelte module. Ignored if `moduleOptions.buildSvelte` is `true` */
    sveltePath?: string,
    /** Whether to set accessors on components' states */
    accessors?: boolean,
    /** Tells the compiler that you promise not to mutate any objects. This allows it to be less conservative about checking whether values have changed. */
    immutable?: boolean,
    /** A number that tells Svelte to break the loop if it blocks the thread for more than `loopGuardTimeout` ms. This is useful to prevent infinite loops. Only available when `dev: true` */
    loopGuardTimeout?: number
  },
  /** Options for the module resolver. This **must not** be defined if `compilerOptions.esm` is `false` */
  moduleOptions?: {
    /** The folder where the compiled modules are or will be built to.
     * > Note: this path is relative to the CWD, not to the `out` directory */
    root?: string,
    /** Whether svbuild should build all the dependencies */
    buildModules?: boolean,
    /** Path to the folder, from which the dependencies are taken from. Default is `./node_modules`
     * @default "node_modules" */
    modulesSrc?: string,
    /** Whether svbuild should build svelte like a regular dependency */
    buildSvelte?: boolean
  }
}
```

An example config file looks like this:

```js
/**
 * @type {import('../config').Config}
 */
const config = {
  src: './svelte',
  out: './out',
  compilerOptions: {
    esm: true,
    dev: true,
    sveltePath: './out/modules/svelte'
  },
  moduleOptions: {
    root: './out/modules',
    buildModules: true,
    buildSvelte: true,
    modulesSrc: 'node_modules'
  }
}

export default config
```

## CLI tool

This is how to use the `svbuild` tool

`svbuild`

- `-s, --src <path>` - Source dir, overrides `config.src`

- `-o, --out <path>` - Output, overrides `config.out`

- `-c, --config <path>` - Path to the configuration file

- `-v, --verbose` - Log internal information

- `-R, --rebuild` - Usually, svbuild doesn't build the same module twice. This option makes it forcefully rebuild all dependencies.

`svbuild watch` - Watches the `src` directory for changes and rebuilds changed files

- `--src, --out, --config, --verbose` is the same as `svbuild`

- `-b, --no-build` - Don't build the project on start.








