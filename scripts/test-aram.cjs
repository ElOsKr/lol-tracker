const { spawnSync } = require("node:child_process");
const path = require("node:path");

// Use Electron's Node ABI, matching the installed SQLite native module.
const result = spawnSync(require("electron"), [path.resolve("tests/aram.test.cjs")], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
