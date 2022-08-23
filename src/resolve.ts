import * as _fs from "fs-extra";
import * as p from "path";
import c from "chalk";
import urlJoin from "url-join";
import { parse } from "url";

const fs = (_fs as any).default as typeof _fs

export function prepareJSPath(path: string) {
  path = path.replaceAll('\\', '/');
  if (path.endsWith('.svelte')) path = path + '.js';
  if (!path.startsWith('.') && !path.startsWith('/') && !path.includes('://')) {
    path = './' + path
  }
  return path;
}

/** Joiner that supports URLs */
export function betterJoin(segment1: string, ...paths: string[]) {
  paths = paths.map(p => p.normalize(p)).filter(p => p != '/'); // don't normalize the 1st segment that contains the url
  return urlJoin(segment1, ...paths)
}

function isURL(path: string) {
  return !!parse(path).protocol;
}

function parsePackageJSON(contents: any, moduleName: string, otherSegments: string, resolution?: string) {
  if ('exports' in contents) {
    function analyzeExports(exportsField: any) {
      if (typeof exportsField == 'string') return exportsField;
      for (const key in exportsField) {
        const element = exportsField[key];
        if (key.startsWith('./')) {
          if (p.normalize(key) != otherSegments) continue;
          if (typeof element == 'string') {
            return element;

          } else {
            return analyzeExports(element)
          }
        } else {
          if (key == resolution || key == 'import') {
            return analyzeExports(element)
          }
        }
      }
      if ('default' in exportsField) {
        return analyzeExports(exportsField.default)
      }

      throw `The "exports" field is invalid.`;
    }

    if (typeof contents.exports == 'string') {
      return contents.exports

    } else {
      if (!contents.exports['.']) throw `Invalid exports field in package.json of module "${moduleName}"`;

      if (otherSegments == '') {
        return analyzeExports(contents.exports['.'])

      } else {
        return analyzeExports(contents.exports)
      }
    }

  } else {
    return contents.module || contents.main;
  }
}

async function resolveModule(modulePath: string, resolution?: string) {
  try {
    const moduleName = modulePath.split('/')[0]
    const otherSegments = modulePath.split('/').slice(1).join('/')

    let packageJSONLocation = p.join(config.moduleOptions.modulesSrc, moduleName, 'package.json');

    if (!(await fs.pathExists(packageJSONLocation))) {
      throw `package.json for module "${moduleName}" \
(in ${p.join(config.moduleOptions.modulesSrc, moduleName, 'package.json')}) \
doesn't exist. ${
        moduleName.includes('.') ? "If you want to import a local file, prepend it with `./`." : ''
      }`;
    }

    const packageJSON = JSON.parse(await fs.readFile(packageJSONLocation, 'utf-8'));

    return {
      path: p.join(p.dirname(packageJSONLocation), parsePackageJSON(packageJSON, moduleName, otherSegments, resolution)),
      moduleName
    }

  } catch (error) {
    console.error(c.red("[ERROR]"), `while resolving "${modulePath}":`, error + '')
    return { path: modulePath, moduleName: '<unknown>' };
  }
}

export async function resolveDependency(from: string, path: string): Promise<{path: string, moduleName?: string} | null> {
  if (isURL(path) || path.startsWith('/')) {
    if (p.extname(path) == "") path += ".js";
    return null;
  }

  if (path.startsWith('.')) {
    if (p.extname(path) == '') path += '.js';
    return { path: p.join(p.dirname(from), path) }

  } else {
    let resolution: string;
    let moduleName = path.split('/')[0];

    if (config.moduleOptions.preferredResolutionType) {
      if (moduleName in config.moduleOptions.preferredResolutionType) {
        resolution = config.moduleOptions.preferredResolutionType[moduleName]
      }
    }

    if (moduleName == 'svelte' && !config.moduleOptions.buildSvelte) return { path: '', moduleName }

    return await resolveModule(path, resolution);
  }
}