import * as _fs from "fs-extra";
import * as pt from "path";
import * as svelte from "svelte/compiler";
import * as acorn from "acorn";
import { resolveImport } from "./resolve.js";
import { logger } from "./config.js";
const fs = _fs.default;
export const compilationMap = {};
const alreadyBuilt = [];
export function includeBuiltModules(modDir) {
    try {
        let entries = fs.readdirSync(modDir);
        alreadyBuilt.push(...entries);
    }
    catch (_) { }
}
function prepareJSPath(path) {
    // make the path import-friendly
    path = path.replaceAll('\\', '/');
    if (path.endsWith('.svelte'))
        path = path + '.js';
    if (!path.startsWith('.') || !path.startsWith('/') || !path.includes('://')) {
        path = './' + path;
    }
    return path;
}
export async function buildAll(dep, to, isDependency) {
    async function dir(path, to) {
        let entries = [];
        try {
            entries = await fs.readdir(path);
        }
        catch (e) {
            console.error(`[BUILD ERROR] Can't get the source of dependency "${dep}" (folder "${path}"). Check if you have it installed in modulesSrc.\nError:`, e);
        }
        for (const en of entries) {
            const enPath = pt.join(path, en);
            const destPath = pt.join(to, en);
            build(dir, enPath, destPath, (e) => {
                console.error(`[BUILD ERROR] Unable to build dependency "${dep}". \n  Error:`, e);
            });
        }
    }
    if (isDependency) {
        let initialDep = dep;
        dep = pt.join(config.moduleOptions.modulesSrc, dep);
        logger("Building dependency %o, path: %o", initialDep, dep);
        await dir(dep, pt.join(to, initialDep));
    }
    else {
        logger("Compiling all from %o to %o", dep, to);
        await dir(dep, to);
    }
}
export async function build(dir, enPath, destPath, onError) {
    try {
        if ((await fs.lstat(enPath)).isDirectory()) {
            await dir(enPath, destPath);
            compilationMap[pt.normalize(enPath)] = { type: 'dir', path: destPath };
        }
        else if (enPath.endsWith('.svelte')) {
            await compile(enPath, destPath + '.js');
            compilationMap[pt.normalize(enPath)] = { type: 'svelte', path: destPath };
        }
        else if (enPath.endsWith('.js') || enPath.endsWith('.mjs')) {
            const code = await modImports(destPath, await fs.readFile(enPath, 'utf-8'));
            await fs.ensureFile(destPath);
            await fs.writeFile(destPath, code);
            compilationMap[pt.normalize(enPath)] = { type: 'js', path: destPath };
        }
        else {
            await fs.copy(enPath, destPath, { recursive: true });
            compilationMap[pt.normalize(enPath)] = { type: 'unknown', path: destPath };
        }
    }
    catch (e) {
        onError(e);
    }
}
export async function compile(from, to) {
    const contents = await fs.readFile(from, 'utf-8');
    let compiled;
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
    }
    catch ({ code, start, end, frame }) {
        console.warn(`[ERROR] in "${from}" (${start.line}:${start.column})\n ${frame.replaceAll('\n', '\n ')}`);
        return;
    }
    compiled.warnings.forEach(w => {
        console.warn(`[WARNING] in "${from}" (${w.start.line}:${w.start.column})\n ${w.frame.replaceAll('\n', '\n ')}`);
    });
    let { code } = compiled.js;
    if (config.moduleOptions?.buildModules) {
        code = await modImports(to, code);
    }
    void async function writeCompiled() {
        await fs.ensureFile(to);
        await fs.writeFile(to, code);
    }();
}
export async function modImports(resolveFrom, code) {
    const { body } = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }); // as any because typescript goes nuts
    let shiftBy = 0;
    for (const node of body) {
        if (node.type != 'ImportDeclaration' && (node.type != 'ExportNamedDeclaration' || node.source == null))
            continue;
        const { source } = node;
        let modPath = source.value;
        let fixedString;
        if (modPath.startsWith('.') || modPath.startsWith('/') || modPath.includes('://')) {
            if (!modPath.endsWith('.js')) {
                modPath += '.js';
            }
            fixedString = modPath;
        }
        else {
            fixedString = analyseAndResolve(pt.dirname(resolveFrom), modPath);
        }
        logger("Converted:", modPath, "->", fixedString);
        let cut = code.slice(source.start + shiftBy - 5, source.end + shiftBy + 5);
        let newCut = cut.replace(source.raw, `"${fixedString.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll("'", "\\'")}"`);
        code = code.replace(cut, newCut);
        shiftBy += newCut.length - cut.length;
    }
    return code;
}
function analyseAndResolve(path, dep) {
    logger(`Analysing "${dep}" from "${path}"`);
    if (!config.moduleOptions?.root)
        return prepareJSPath(dep);
    const root = pt.relative(path, config.moduleOptions.root);
    let firstSegment = dep.split('/')[0];
    let stripped = dep.replace(firstSegment, '').slice(1); // slice(1) removes the slash
    if (!config.moduleOptions.buildSvelte) {
        if (firstSegment == 'svelte') {
            if (pt.extname(stripped) == '')
                stripped = pt.join(stripped, 'index.mjs');
            logger('Imported svelte module:', pt.join(config.compilerOptions.sveltePath, stripped));
            return prepareJSPath(pt.join(config.compilerOptions.sveltePath, stripped));
        }
    }
    let relativePathToMod = pt.join(root, firstSegment);
    let prePath = prepareJSPath(pt.join(relativePathToMod, stripped));
    if (config.moduleOptions.buildModules && !alreadyBuilt.includes(firstSegment)) {
        try {
            buildAll(firstSegment, config.moduleOptions.root, true).then(() => alreadyBuilt.push(firstSegment));
        }
        catch (e) {
            console.error(`[BUILD ERROR] Unable to build "${dep}".\n  Error:`, e);
        }
    }
    if (prePath.endsWith('.js')) {
        return prePath;
    }
    else {
        return resolveImport(dep, prePath, relativePathToMod);
    }
}
