import * as pt from "path";
export const defaultConfig = {
    src: 'src',
    out: 'out',
    compilerOptions: {
        dev: true,
        esm: true,
        sveltePath: "svelte"
    },
    moduleOptions: {
        root: "modules",
        buildModules: false,
        modulesSrc: 'node_modules',
        buildSvelte: false,
        usePreprocessorsWithModules: false,
        preferredResolutionType: {}
    }
};
let configPath;
export const resolveFromConfig = (path) => pt.join(pt.dirname(configPath), path);
export async function importConfig(path) {
    configPath = pt.resolve(path);
    try {
        let c = await import('file:///' + configPath.replaceAll('\\', '/'));
        global.config = c.default;
    }
    catch (_) {
        console.log("Configuration file not found.");
        process.exit(1);
    }
    if (!('moduleOptions' in config)) {
        config.moduleOptions = defaultConfig.moduleOptions;
    }
    if (!config.moduleOptions.preferredResolutionType) {
        config.moduleOptions.preferredResolutionType = defaultConfig.moduleOptions.preferredResolutionType;
    }
    if (!config.moduleOptions.usePreprocessorsWithModules) {
        config.moduleOptions.usePreprocessorsWithModules = defaultConfig.moduleOptions.usePreprocessorsWithModules;
    }
    config.src = resolveFromConfig(config.src);
    config.out = resolveFromConfig(config.out);
    config.moduleOptions.modulesSrc = resolveFromConfig(config.moduleOptions.modulesSrc);
}
export function logger(...info) {
    if (!global.verbose)
        return;
    console.log(...info);
}
