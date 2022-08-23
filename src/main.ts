#!/usr/bin/env node
import { program } from "commander";
import type { Config } from "../types";
import { buildFile, buildAll, buildMap } from "./compile.js";
import { defaultConfig, importConfig, logger } from "./config.js";
import * as chokidar from "chokidar";
import * as pt from "path";
import * as _fs from "fs-extra";

const fs = (_fs as any).default as typeof _fs

declare global {
  var config: Config
  var verbose: boolean
}

program.name("svbuild")
  .option("-c, --config <path>", "Path to the configuration file", './svbuild.config.js')
  .option("-v, --verbose", "Log internal information")
  .option("-w, --watch", "Watch the src directory for changes")
  .option("-B, --no-build", "Don't build everything at first, only works with --watch")
  .action(async({ config: cPath, verbose, build: shouldBuild, watch }) => {
    if (!watch && !shouldBuild) {
      console.error("Options --no-build can only be specified with --watch.");
      process.exit(1)
    }
    await importConfig(cPath);

    config.compilerOptions ||= Object.assign(defaultConfig.compilerOptions, config.compilerOptions);
    if (config.moduleOptions) {
      config.moduleOptions = Object.assign(defaultConfig.moduleOptions, config.moduleOptions);
    }

    global.verbose = verbose

    if (config.compilerOptions?.esm == false && config.moduleOptions) {
      console.error(`compilerOptions.esm cannot be %o with config.moduleOptions`, false);
      process.exit(1)
    }

    if (shouldBuild) {
      buildAll(config.src)
    }

    if (!watch) return;

    const watcher = chokidar.watch('.', { atomic: true, cwd: config.src, persistent: true });

    watcher.on('ready', () => {
      console.log('Watching', config.src)
      watcher.on('add', (path) => {
        let from = pt.join(config.src, path)
        let dest = pt.join(config.out, path);

        console.log(`Building`, dest);
        buildFile(from)
      });
  
      watcher.on('unlink', (path) => {
        if (!path) return;
        path = pt.join(config.src, path);
  
        if (path in buildMap) {
          const built = buildMap[path];
          if (!built) return;

          logger(`Unlinking "${built}" for "${path}"`);
          console.log(`Removing`, built);
          fs.rmSync(built, { recursive: true })
          delete buildMap[path]
          return;
        }
        logger(`no unlink for ${path}`);
      })
      watcher.on('unlinkDir', (path) => {
        if (!path) return;
        path = pt.join(config.src, path);
  
        if (path in buildMap) {
          const built = buildMap[path];
          if (!built) return;

          logger(`Unlinking "${built}" for "${path}"`);
          console.log(`Removing`, built);
          fs.rmSync(built, { recursive: true })
          return;
        }
        logger(`no unlink for ${path}`);
      })
  
      watcher.on('change', (path) => {
        if (!path) return;
        let from = pt.join(config.src, path);
  
        map: if (from in buildMap) {
          const built = buildMap[from];
          logger(`Changing "${built}" for "${from}"`);
          if (!built) break map;

          console.log(`Building`, built);
          buildFile(from)
          return;
        }
        let dest = pt.join(config.out, path);

        console.log(`Building`, dest);
        buildFile(from)
      })
    })
  })
;


program.command("watch").description("Watches the src directory for changes")
  .option("-c, --config <path>", "Path to the configuration file", './svbuild.config.js')
  .option("-v, --verbose", "Log internal information")
  .option("-B, --no-build", "Don't build everything at first")
  .action(async({ config: cPath, verbose, build: shouldBuild }) => {
    console.log(process.argv, {config: cPath, verbose, build: shouldBuild});

    await importConfig(cPath);

    config.compilerOptions ||= Object.assign(defaultConfig.compilerOptions, config.compilerOptions);
    if (config.moduleOptions) {
      config.moduleOptions = Object.assign(defaultConfig.moduleOptions, config.moduleOptions);
    }

    global.verbose = verbose

    if (!(config.compilerOptions?.esm) && config.moduleOptions) {
      console.error(`compilerOptions.esm cannot be %o with config.moduleOptions`, false);
      process.exit(1)
    }


  })
;

program.parse();