import * as _fs from "fs-extra";
import c from "chalk";
import * as svelte from "svelte/compiler";
import * as p from "path";
import * as acorn from "acorn";
import { logger } from "./config.js";
import { resolveDependency } from "./resolve.js";

const fs = (_fs as any).default as typeof _fs;


type DependsOn = (dep: string) => Promise<string>

export async function modImports(code: string, dependsOn: DependsOn) {
  const { body } = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }) as any; // as any because typescript goes nuts

  let shiftBy = 0;
  for (const node of body) {
    // maybe should switch to recast (or magic-string) instead of this
    if (node.type != 'ImportDeclaration' && (node.type != 'ExportNamedDeclaration' || node.source == null)) continue;
    
    const { source } = node;

    let modPath = source.value as string;
    let fixedString: string;

    fixedString = await dependsOn(modPath);

    // actually no idea why 5 characters
    let cut = code.slice(source.start + shiftBy - 5, source.end + shiftBy + 5);
    let newCut = cut.replace(source.raw, `"${fixedString.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll("'", "\\'")}"`);

    code = code.replace(cut, newCut)

    shiftBy += newCut.length - cut.length;
  }

  return code;
}

export async function svelteTool(filename: string, contents: string, dependsOn: DependsOn, moduleName: string) {
  let compiled: ReturnType<typeof svelte.compile>;
  try {
    let code = contents;
    const setCode = async () => code = (await svelte.preprocess(contents, config.preprocess || [], { filename })).code
    if (moduleName) {
      if (typeof config.moduleOptions.usePreprocessorsWithModules == 'object') {
        if (moduleName in config.moduleOptions.usePreprocessorsWithModules) {
          if (config.moduleOptions.usePreprocessorsWithModules[moduleName]) {
            await setCode()
          }
        }
      } else if (config.moduleOptions.usePreprocessorsWithModules) {
        await setCode()
      }
      
    } else {
      await setCode()
    }

    compiled = svelte.compile(code, {
      css: true,
      accessors: config.compilerOptions.accessors,
      immutable: config.compilerOptions.immutable,
      loopGuardTimeout: config.compilerOptions.loopGuardTimeout,
      generate: 'dom',
      format: config.compilerOptions.esm ? 'esm' : 'cjs',
      filename,
      dev: config.compilerOptions.dev,
      sveltePath: config.moduleOptions ? 'svelte' : config.compilerOptions.sveltePath, // sveltePath is handled by svbuild
      ...(config.compilerOptions.other || {})
    });

  } catch (err) {
    if ('start' in err) {
      let { start, frame } = err;
      throw `in "${filename}" (${start.line}:${start.column})\n ${frame.replaceAll('\n', '\n ')}`;
      
    } else {
      throw `in preprocessing step of "${filename}":\n ${err.toString().replaceAll('\n', '\n ')}`;
    }
  }

  compiled.warnings.forEach(w => {
    console.warn(`${c.yellow("[WARNING]")} in "${filename}" (${w.start.line}:${w.start.column})\n ${w.frame.replaceAll('\n', '\n ')}
  ${w.message.replaceAll('\n', '\n  ')}`);
  })

  let { code }: { code: string } = compiled.js;

  if (config.moduleOptions?.buildModules) {
    code = await modImports(code, dependsOn);
  }

  return { code, filename: filename + '.js' };
}

export async function jsTool(filename: string, contents: string, dependsOn: DependsOn) {
  if (filename.endsWith('.mjs')) {
    filename = filename.slice(0, -4) + '.js'
  }
  if (p.extname(filename) != '.js') {
    filename = filename + '.js'
  }
  return { filename, code: await modImports(contents, dependsOn) }
}

export async function copyTool(filename: string, code: string) {
  return { filename, code }
}


function formatPath(path: string) {
  path = path.replaceAll('\\', '/');
  if (path.startsWith('.')) {
    return path
  }
  return './' + path
}

function findRelativePath(path: string, src: string, moduleName?: string) {
  if (path.startsWith(src)) {
    return p.relative(src, p.dirname(path));

  } else if (!moduleName) {
    throw `A file required that lies outside of the "src" directory. (path: ${path})`;

  } else {
    const fileModulePath = p.relative(config.moduleOptions.modulesSrc, p.dirname(path));

    // path is outside src
    if (!config.moduleOptions.buildModules) return false;
    
    return p.join(config.moduleOptions.root, fileModulePath)
  }
}

export const buildMap: Record<string, string | false> = {};

export async function buildFile(path: string, moduleName?: string) {
  /** In an event of a circular dependency, we shadow-compile this file and return the path of it.
   * Then, the compilation resumes normally. */
  let IS_PENDING: boolean;
  
  path = p.normalize(path);
  if (path in buildMap) {
    const inMap = buildMap[path];
    if (inMap == false) { IS_PENDING = true }
    else return inMap;
  }

  try {
    const relPath = findRelativePath(path, config.src, moduleName)

    if (relPath === false) return false;

    buildMap[p.normalize(path)] = false; // pending build

    const outPath = p.join(config.out, relPath)

    const contents = await fs.readFile(path, 'utf-8');

    let tool: (filename: string, contents: string, dependsOn: DependsOn, moduleName: string) => Promise<{ code: string, filename: string }>;

    if (path.endsWith('.svelte')) {
      tool = svelteTool;

    } else if (path.endsWith('.mjs') || path.endsWith('.js')) {
      tool = jsTool;

    } else {
      tool = copyTool;
    }

    logger("Building", c.green(path))
    const { code, filename } = await tool(
      p.basename(p.relative(config.src, path)),
      contents,
      async function dependsOn(dep) {
        logger("Dependency:", c.cyan(dep))
        if (IS_PENDING) return dep; // to prevent infinite loops

        const resolved = await resolveDependency(path, dep);
        logger("Resolved dependency:", resolved)
        if (!resolved) return dep; // external dependency, such as a URL

        if (resolved.moduleName == 'svelte' && !config.moduleOptions.buildSvelte) {
          logger("Replacing 'svelte' with `sveltePath`")
          return dep.replace('svelte', config.compilerOptions.sveltePath);
        }
        const builtPath = await buildFile(resolved.path, resolved.moduleName || moduleName);

        if (builtPath === false) return dep;

        const formattedPath = formatPath(p.relative(outPath, builtPath))
        logger("Dependecy built, formatted path:", c.green(formattedPath))
        return formattedPath;
      },
      moduleName
    );

    const realPath = p.join(outPath, filename);

    if (!IS_PENDING) {
      logger("Finished building", c.green(path), "\nWriting to", c.green(realPath))
      await fs.ensureFile(realPath)
      await fs.writeFile(realPath, code)
    } else logger("Finished shadow-building", c.green(path))

    buildMap[p.normalize(path)] = realPath;

    return realPath;

  } catch (err) {
    console.error(c.red("[ERROR]"), `while trying to build "${path}":`, (err.stack ?? err) + '')
    return false;
  }
}

export async function buildAll(path: string) {
  const entries = await fs.readdir(path);
  for (const e of entries) {
    const finalPath = p.join(path, e);
    const stat = await fs.lstat(finalPath)
    if (stat.isDirectory()) {
      await buildAll(finalPath)

    } else if (stat.isFile()) {
      await buildFile(finalPath)
    }
  }
}