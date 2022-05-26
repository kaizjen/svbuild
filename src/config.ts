import * as pt from "path";
import { Config } from "../config";

export const defaultConfig: Config = {
  src: '',
  out: '',
  compilerOptions: {
    dev: true,
    esm: true,
    sveltePath: "svelte"
  },
  moduleOptions: {
    root: "modules",
    buildModules: false,
    modulesSrc: 'node_modules',
    buildSvelte: false
  }
}

export async function importConfig(path: string = './svlc.config.js') {
  path = pt.resolve(path)
  
  try {
    let c = await import('file:///' + path.replaceAll('\\', '/'));
    global.config = c.default
    
  } catch (_) {
    console.log("Configuration file not found.");
    global.config = defaultConfig
  }
}

export function logger(...info: any[]) {
  if (!global.verbose) return;
  console.log(...info)
}