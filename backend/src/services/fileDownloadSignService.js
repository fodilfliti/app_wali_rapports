const jwt = require("jsonwebtoken");
const { getEnv } = require("../config/env");

const FILE_DL_TTL = "60s";

/** Normalize client path to storage rel path (e.g. uploads/foo.jpg). */
function normalizeStorageRelPath(input) {
  let p = String(input || "").trim();
  if (!p) return null;
  try {
    if (/^https?:\/\//i.test(p)) {
      p = new URL(p).pathname;
    }
  } catch {
    return null;
  }
  p = p.split("?")[0].split("#")[0];
  if (p.startsWith("/files/")) p = p.slice("/files/".length);
  if (p.startsWith("/")) p = p.slice(1);
  if (!p || p.includes("..")) return null;
  return p;
}

function signFileDownload(userId, storageRelPath) {
  const path = normalizeStorageRelPath(storageRelPath);
  if (!path) {
    const err = new Error("Invalid path");
    err.status = 400;
    throw err;
  }
  return jwt.sign(
    { sub: String(userId), path, typ: "file_dl" },
    getEnv().jwtSecret,
    { expiresIn: FILE_DL_TTL, algorithm: "HS256" }
  );
}

function verifyFileDownloadToken(token, storageRelPath) {
  const payload = jwt.verify(token, getEnv().jwtSecret, { algorithms: ["HS256"] });
  if (payload.typ !== "file_dl") {
    const err = new Error("Invalid token");
    err.status = 401;
    throw err;
  }
  const normalized = normalizeStorageRelPath(storageRelPath);
  if (!normalized || payload.path !== normalized) {
    const err = new Error("Invalid token");
    err.status = 401;
    throw err;
  }
  return payload.sub;
}

function buildSignedFileUrl(storageRelPath, dlToken) {
  const path = normalizeStorageRelPath(storageRelPath);
  return `/files/${path}?dl=${encodeURIComponent(dlToken)}`;
}

module.exports = {
  FILE_DL_TTL,
  normalizeStorageRelPath,
  signFileDownload,
  verifyFileDownloadToken,
  buildSignedFileUrl,
};
