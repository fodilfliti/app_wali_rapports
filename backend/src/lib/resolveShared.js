"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Resolve compiled shared package dist (access-policy | routes).
 * - Monorepo: <repo>/shared/<pkg>/dist
 * - cPanel zip: <wali-api>/shared/<pkg>/dist  (copied by package-deploy.ps1)
 */
function resolveSharedDist(packageName) {
  const backendRoot = path.join(__dirname, "../..");
  const candidates = [
    path.join(backendRoot, "shared", packageName, "dist"),
    path.join(backendRoot, "..", "shared", packageName, "dist"),
  ];
  for (const dir of candidates) {
    const indexJs = path.join(dir, "index.js");
    if (fs.existsSync(indexJs)) return dir;
  }
  throw new Error(
    `Cannot find shared/${packageName}/dist (build shared + redeploy). Tried:\n${candidates.join("\n")}`,
  );
}

module.exports = { resolveSharedDist };
