#!/usr/bin/env node
import { program } from "commander";
import type { Config } from "../config";
import { build, buildAll, compilationMap, includeBuiltModules } from "./compile.js";
import { defaultConfig, importConfig, logger } from "./config.js";
import * as chokidar from "chokidar";
import * as pt from "path";
import * as _fs from "fs-extra";

const fs = (_fs as any).default as typeof _fs

declare global {
  var config: Config
  var verbose: boolean
}

program.name("svbuild").option("-s, --src <path>", "Compile files from this directory")
  .option("-o, --out <path>", "Compile files to this directory")
  .option("-c, --config <path>", "Path to the configuration file")
  .option("-v, --verbose", "Log internal information")
  .option("-R, --rebuild", "Rebuild modules in out dir.")
  .action(async({ src, out, config: cPath, verbose, rebuild }) => {
    await importConfig(cPath);
    out = config.out || out
    src = config.src || src

    config.compilerOptions ||= Object.assign(defaultConfig.compilerOptions, config.compilerOptions);
    if (config.moduleOptions) {
      config.moduleOptions = Object.assign(defaultConfig.moduleOptions, config.moduleOptions);

      if (!rebuild) {
        includeBuiltModules(config.moduleOptions.root)
      }
    }

    global.verbose = verbose

    if (!out || !src) {
      console.error(`Directories "out" and/or "src" are not specified.`);
      process.exit(1)
    }

    if (config.compilerOptions?.esm == false && config.moduleOptions) {
      console.error(`compilerOptions.esm cannot be %o with config.moduleOptions`, false);
      process.exit(1)
    }

    buildAll(src, out)
  })
;


program.command("watch").description("Watches the src directory for changes")
  .option("-s, --src <path>", "Compile files from this directory")
  .option("-o, --out <path>", "Compile files to this directory")
  .option("-c, --config <path>", "Path to the configuration file")
  .option("-b, --no-build", "Don't build everything at first")
  .option("-v, --verbose", "Log internal information")
  .action(async({ src, out, config: cPath, verbose, build: shouldBuild }) => {
    await importConfig(cPath);
    out = out || config.out
    src = src || config.src

    config.compilerOptions ||= Object.assign(defaultConfig.compilerOptions, config.compilerOptions);
    if (config.moduleOptions) {
      config.moduleOptions = Object.assign(defaultConfig.moduleOptions, config.moduleOptions);
    }

    global.verbose = verbose

    if (!out || !src) {
      console.error(`Directories "out" and/or "src" are not specified.`);
      process.exit(1)
    }

    if (!(config.compilerOptions?.esm) && config.moduleOptions) {
      console.error(`compilerOptions.esm cannot be %o with config.moduleOptions`, false);
      process.exit(1)
    }

    if (shouldBuild) {
      buildAll(src, out)
    }

    const watcher = chokidar.watch('.', { atomic: true, cwd: src, persistent: true });

    watcher.on('ready', () => {
      console.log('ready', src)
      watcher.on('add', (path) => {
        let from = pt.join(src, path)
        let dest = pt.join(out, path);

        console.log(`Building`, dest);
        build(buildAll, from, dest, (e) => {
          console.error(`Error while building "${path}" to "${dest}".\nError:`, e)
        })
      });
      watcher.on('addDir', (path) => {
        if (!path) return;
  
        path = pt.join(src, path);
        let dest = pt.join(out, path);
        buildAll(path, dest)
      });
  
      watcher.on('unlink', (path) => {
        if (!path) return;
        path = pt.join(src, path);
  
        if (path in compilationMap) {
          const map = compilationMap[path];
          logger(`Unlinking "${map.path}" for "${path}"`);
          console.log(`Removing`, map.path);
          fs.rmSync(map.path, { recursive: true })
          return;
        }
        logger(`no unlink for ${path}`);
      })
      watcher.on('unlinkDir', (path) => {
        if (!path) return;
        path = pt.join(src, path);
  
        if (path in compilationMap) {
          const map = compilationMap[path];
          logger(`Unlinking "${map.path}" for "${path}"`);
          console.log(`Removing`, map.path);
          fs.rmSync(map.path, { recursive: true })
          return;
        }
        logger(`no unlink for ${path}`);
      })
  
      watcher.on('change', (path) => {
        if (!path) return;
        let from = pt.join(src, path);
  
        if (from in compilationMap) {
          const map = compilationMap[from];
          logger(`Changing "${map.path}" for "${from}"`);
  
          console.log(`Building`, map.path);
          build(buildAll, from, map.path, (e) => {
            console.error(`Error while building "${from}" to "${map.path}".\nError:`, e)
          })
          return;
        }
        let dest = pt.join(out, path);

        console.log(`Building`, dest);
        build(buildAll, from, dest, (e) => {
          console.error(`Error while building "${path}" to "${dest}".\nError:`, e)
        })
      })
    })

  })
;

program.parse();