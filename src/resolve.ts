import * as _fs from "fs-extra";
import * as pt from "path";
import urlJoin from "url-join";

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
  paths = paths.map(p => pt.normalize(p)).filter(p => p != '/'); // don't normalize the 1st segment that contains the url
  return urlJoin(segment1, ...paths)
}

export function resolveImport(dep: string, initialPath: string, relativePath: string) {
  let firstSegment = dep.split('/')[0];
  let stripped = dep.replace(firstSegment, '').slice(1); // slice(1) removes the slash

  let package_json: any;
  try {
    package_json = JSON.parse(fs.readFileSync(pt.join(config.moduleOptions.modulesSrc, firstSegment, 'package.json'), 'utf-8'));

  } catch (e) {
    console.error(`[BUILD ERROR] Unable to resolve "${dep}". Check if you have the dependency installed.\n  Error:`, e)
    return initialPath;
  }

  if (firstSegment == dep) {
    let { main, module: _module, exports: _exports } = package_json;

    if (!_exports || typeof _exports != 'object') {
      return prepareJSPath(pt.join(initialPath, _module || main || 'index.js'))
    }

    let exportedMod_any = _exports['.'];
    let exportedMod: string;

    if (typeof exportedMod_any == 'string') {
      exportedMod = exportedMod_any;
    } else {
      exportedMod = exportedMod_any.import
    }

    let final = exportedMod ? pt.join(relativePath, exportedMod) : pt.join(initialPath, _module || main || 'index.js')
    return prepareJSPath(final);

  } else {
    let index = 'index.js';
    let { exports: _exports } = package_json;

    if (!_exports || typeof _exports != 'object') {
      return prepareJSPath(pt.join(initialPath, index))
    }

    let normalized = pt.normalize(stripped).replaceAll('\\', '/');
    let exportedMod_any = _exports[normalized] || _exports['./' + normalized];

    let exportedMod: string;

    if (exportedMod_any == undefined) {
      let separated = stripped.split('/');

      let prevSegments = [];
      for (const segment of separated) {
        let joined = prevSegments.join('/');

        let normalized = pt.normalize((joined ? (joined + '/') : '') + stripped).replaceAll('\\', '/');
        exportedMod_any =
          _exports[normalized] ||
          _exports['./' + normalized]
        ;

        if (exportedMod_any) {
          break;
        }

        prevSegments.push(segment)
      }
    }

    if (typeof exportedMod_any == 'string') {
      exportedMod = exportedMod_any;

    } else if (exportedMod_any == undefined) {
      console.error(`[BUILD ERROR] Unable to find exports for "${dep}". Using "${pt.join(initialPath, index)}"`);

    } else {
      exportedMod = exportedMod_any.import
    }

    let final = exportedMod ? pt.join(relativePath, exportedMod) : pt.join(initialPath, index)
    return prepareJSPath(final);
  }
}