# svbuild (beta)

>  A simple tool that builds your svelte files without bundling them.

## Why

Sometimes, bundlers are a bit too much. They have a lot of configuration and the output they produce is sometimes unnecessary. For example, when you're building an embedded application in CEF or in Electron, you know for a fact that the latest js features are supported. This is a tool that will build your dependencies for svelte and produce browser-friendly imports: `import { onMount } from "svelte"` becomes `import { onMount } from "../modules/svelte/index.mjs"`.

This tool is **not** for making websites. For that, use `SvelteKit` or a bundler.

## Getting started

- Install svbuild globally by running `npm i svbuild -g` or locally: `npm i svbuild -D`

- Create a folder with two subfolders: `/src` and `/out`.

- In the root of this folder place a `package.json` with `"type": "module"`.

- In the root also create a file called `svbuild.config.js`. What to write in it is explained below.

- Write your svelte code in the src dir.

- Run `svbuild`.

- Enjoy.

## Configuration

All configuration is in the `svbuild.config.js`.

This is the type for the config file:

```ts
export type Config = {
  /** Path to source directory with svelte code */
  src: string,
  /** Path to output directory */
  out: string,
  /** Svelte compiler options */
  compilerOptions?: {
    /** Whether to generate code with ES6 imports and exports. Note that svbuild doesn't provide a `require()` funtion! */
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
  /** Preprocessors allow for integration of different languages and features into svelte. */
  preprocess?: PreprocessorGroup | PreprocessorGroup[]
  /** Options for the module resolver. This **must not** be defined if `compilerOptions.esm` is `false` */
  moduleOptions?: {
    /** The folder where the compiled modules are or will be built to.
     * > Note: this path is relative to the `out` directory */
    root?: string
    /** Whether svbuild should build all the dependencies */
    buildModules?: boolean
    /** Path to the folder, from which the dependencies are taken from. Default is `"node_modules"`
     * @default "node_modules" */
    modulesSrc?: string
    /** Whether svbuild should build svelte like a regular dependency */
    buildSvelte?: boolean
    /** Whether svbuild should preprocess module code. Can be either set to boolean, or to an object with module names as keys. */
    usePreprocessorsWithModules?: boolean | {
      [moduleName: string]: string
    }
    /** The preferred type of the `exports` field. Is usually `"browser"`, but can be set to anything else if that's causing problems */
    preferredResolutionType?: {
      [moduleName: string]: string
    }
  }
}
```

An example config file looks like this:

```js
/**
 * @type {import('svbuild/types').Config}
 */
const config = {
  src: './svelte',
  out: './out',
  compilerOptions: {
    esm: true,
    dev: true
  },
  moduleOptions: {
    root: 'modules',
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

- `-c, --config <path>` - Path to the configuration file (default: `./svbuild.config.js`)

- `-v, --verbose` - Log internal information

- `-w, --watch` - Watch the src directory for changes.

- `-B, --no-build` - Don't build the project at first, only works with --watch

## Limitations

Currently, svbuild doesn't support source maps. This will probably be implemented in a next major version.

Also note that svbuild is still in beta so it can include bugs. Please report all issues on Github.








