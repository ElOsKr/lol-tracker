// The one thing every test file needs: loading a TypeScript module from the
// app without a build step, with its imports swappable for fakes.
//
// Shared from here since the suite was split by area. It used to sit at the
// top of a single 2,631-line file, which is the size at which nobody reads
// the whole thing before adding to it.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

// TypeScript 7 no longer exposes transpileModule, so esbuild — which Vite
// brings along anyway — does the stripping.
const transpile = (code) =>
  esbuild.transformSync(code, { loader: "ts", format: "cjs", target: "es2022" }).code;

/**
 * Loads one source file as a module.
 *
 * `mocks` replaces an import by the exact specifier the file uses. Note that
 * a mock's own state has to live in a closure rather than on `this`: the
 * interop wrapper copies the object's properties, so a method that reads
 * `this` reads the copy.
 */
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => (Object.hasOwn(mocks, name) ? mocks[name] : original(name));
  mod._compile(transpile(fs.readFileSync(filename, "utf8")), filename);
  return mod.exports;
}

// Lets a test `require` a .ts file directly, for the cases that pull one in
// through another module rather than through load().
require.extensions[".ts"] = (mod, filename) => {
  mod._compile(transpile(fs.readFileSync(filename, "utf8")), filename);
};

/** The repository root, for tests that read a source file as text. */
const repoRoot = path.resolve(__dirname, "..");

module.exports = { load, transpile, repoRoot };
