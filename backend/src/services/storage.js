const fs = require("fs");
const path = require("path");
const { getEnv } = require("../config/env");

function storageRoot() {
  const env = getEnv();
  const root = env.fileStorageRoot || path.join(process.cwd(), "storage");
  return path.resolve(root);
}

function ensureStorageDirs() {
  const root = storageRoot();
  for (const sub of ["exports", "pdf", "uploads", "uploads/.tmp"]) {
    const dir = path.join(root, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { storageRoot, ensureStorageDirs };
