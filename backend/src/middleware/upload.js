const multer = require("multer");
const { maxBytesForMime } = require("../services/uploadService");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    // Cap bracket nesting (multer ≥2.2.0) — we only use flat field names like "file" / "files".
    fieldNestingDepth: 1,
    fields: 20,
  },
  fileFilter(req, file, cb) {
    const mime = file.mimetype || "application/octet-stream";
    if (file.size && file.size > maxBytesForMime(mime)) {
      return cb(new Error("File too large"));
    }
    cb(null, true);
  }
});

function singleUpload(fieldName = "file") {
  return upload.single(fieldName);
}

function multiUpload(fieldName = "files", maxCount = 10) {
  return upload.array(fieldName, maxCount);
}

module.exports = { singleUpload, multiUpload };
