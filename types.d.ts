import { PreprocessorGroup } from "svelte/types/compiler/preprocess"

/**
 * Configuration for `svbuild`. All paths are relative to CWD.
 */
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