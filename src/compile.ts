import * as _fs from "fs-extra";
import * as pt from "path";
import * as svelte from "svelte/compiler";
import * as acorn from "acorn";
import { betterJoin, prepareJSPath, resolveImport } from "./resolve.js";
import { logger } from "./config.js";
import c from "chalk";

const fs = (_fs as any).default as typeof _fs
const BUILD_ERROR = c.bgRed("[BUILD ERROR]")

export const compilationMap: Record<string, { path: string, type: 'dir' | 'svelte' | 'js' | 'unknown' }> = {}

const alreadyBuilt: string[] = []

export function includeBuiltModules(modDir: string) {
  try {
    let entries = fs.readdirSync(modDir);
    alreadyBuilt.push(...entries)

  } catch (_) {}
}


export async function buildAll(dep: string, to: string, isDependency?: boolean) {
  async function dir(path: string, to: string) {
    let entries: string[] = []
    try {
      entries = await fs.readdir(path);

    } catch (e) {
      console.error(`${BUILD_ERROR} Can't get the source of dependency "${dep}" (folder "${path}"). Check if you have it installed in modulesSrc.\nError:`, e);
      return;
    }

    for (const en of entries) {
      const enPath = betterJoin(path, en)
      const destPath = betterJoin(to, en)
      build(dir, enPath, destPath, (e) => {
        console.error(`${BUILD_ERROR} Unable to build dependency "${dep}". \n  Error:`, e)
      })
    }
  }
  if (isDependency) {
    let initialDep = dep;
    dep = betterJoin(config.moduleOptions.modulesSrc, dep);
    logger("Building dependency %o, path: %o", initialDep, dep)
    await dir(dep, betterJoin(to, initialDep))
    
  } else {
    logger("Compiling all from %o to %o", dep, to)
    await dir(dep, to)
  }
}

export async function build(dir: (from: string, to: string) => any, enPath: string, destPath: string, onError: (e: Error) => any) {
  try {
    if ((await fs.lstat(enPath)).isDirectory()) {
      await dir(enPath, destPath)
      compilationMap[pt.normalize(enPath)] = { type: 'dir', path: destPath }

    } else if (enPath.endsWith('.svelte')) {
      await compile(enPath, destPath + '.js')
      compilationMap[pt.normalize(enPath)] = { type: 'svelte', path: destPath }

    } else if (enPath.endsWith('.js') || enPath.endsWith('.mjs')) {
      const code = await modImports(destPath, await fs.readFile(enPath, 'utf-8'));
      await fs.ensureFile(destPath);
      await fs.writeFile(destPath, code);
      compilationMap[pt.normalize(enPath)] = { type: 'js', path: destPath }

    } else {
      await fs.copy(enPath, destPath, { recursive: true, overwrite: false })
      compilationMap[pt.normalize(enPath)] = { type: 'unknown', path: destPath }
    }

  } catch (e) {
    onError(e);
  }
}

export async function compile(from: string, to: string) {
  const contents = await fs.readFile(from, 'utf-8');

  let compiled: ReturnType<typeof svelte.compile>;
  try {
    compiled = svelte.compile(contents, {
      css: true,
      accessors: config.compilerOptions.accessors,
      immutable: config.compilerOptions.immutable,
      loopGuardTimeout: config.compilerOptions.loopGuardTimeout,
      generate: 'dom',
      format: config.compilerOptions.esm ? 'esm' : 'cjs',
      filename: pt.basename(from),
      dev: config.compilerOptions.dev,
      sveltePath: config.moduleOptions ? 'svelte' : config.compilerOptions.sveltePath // sveltePath is handled by svbuild
    });

  } catch ({ code, start, end, frame }) {
    console.warn(`${c.red("[ERROR]")} in "${from}" (${start.line}:${start.column})\n ${frame.replaceAll('\n', '\n ')}`);
    return;
  }

  compiled.warnings.forEach(w => {
    console.warn(`${c.yellow("[WARNING]")} in "${from}" (${w.start.line}:${w.start.column})\n ${w.frame.replaceAll('\n', '\n ')}
  ${w.message.replaceAll('\n', '\n  ')}`);
  })

  let { code }: { code: string } = compiled.js;

  if (config.moduleOptions?.buildModules) {
    code = await modImports(to, code);
  }

  void async function writeCompiled() {
    await fs.ensureFile(to)
    await fs.writeFile(to, code);
  }()
}

export async function modImports(resolveFrom: string, code: string) {
  const { body } = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }) as any; // as any because typescript goes nuts

  let shiftBy = 0;
  for (const node of body) {
    // maybe should switch to recast (or magic-string) instead of this 
    // also it would make it easier to plug it into the preprocessor instead of post-processing
    if (node.type != 'ImportDeclaration' && (node.type != 'ExportNamedDeclaration' || node.source == null)) continue;
    
    const { source } = node;

    let modPath = source.value as string;
    let fixedString: string;
    if (modPath.startsWith('.') || modPath.startsWith('/') || modPath.includes('://')) {
      if (!modPath.endsWith('.js') && !modPath.endsWith('.mjs')) {
        modPath += '.js';
      }
      fixedString = modPath;

    } else {
      fixedString = analyseAndResolve(pt.dirname(resolveFrom), modPath);
    }


    logger("Converted:", modPath, "->", fixedString)

    // actually no idea why 5 characters
    let cut = code.slice(source.start + shiftBy - 5, source.end + shiftBy + 5);
    let newCut = cut.replace(source.raw, `"${fixedString.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll("'", "\\'")}"`);

    code = code.replace(cut, newCut)

    shiftBy += newCut.length - cut.length;
  }

  return code;
}

/** makes all imports relative */
function analyseAndResolve(path: string, dep: string) {
  logger(`Analysing "${dep}" from "${path}"`);

  if (!config.moduleOptions?.root) return prepareJSPath(dep);
  
  const root = pt.relative(path, config.moduleOptions.root)

  let firstSegment = dep.split('/')[0];
  let stripped = dep.replace(firstSegment, '').slice(1); // slice(1) removes the slash
  
  if (!config.moduleOptions.buildSvelte) {
    if (firstSegment == 'svelte') {
      if (pt.extname(stripped) == '') stripped = betterJoin(stripped, 'index.mjs')

      logger('Imported svelte module:', betterJoin(config.compilerOptions.sveltePath, stripped));
      return prepareJSPath(betterJoin(config.compilerOptions.sveltePath, stripped))
    }
  }

  let relativePathToMod = betterJoin(root, firstSegment);

  let prePath = prepareJSPath(betterJoin(relativePathToMod, stripped));

  if (config.moduleOptions.buildModules && !alreadyBuilt.includes(firstSegment)) {
    void async function () {
      try {
        await buildAll(firstSegment, config.moduleOptions.root, true).then(() => alreadyBuilt.push(firstSegment))
  
      } catch (e) {
        console.error(`${BUILD_ERROR} Unable to build "${dep}".\n  Error:`, e)
      }
    }()
  }

  if (prePath.endsWith('.js')) {
    return prePath;
    
  } else {
    return resolveImport(dep, prePath, relativePathToMod)
  }
}