const multer = require("multer");
const { maxBytesForMime } = require("../services/uploadService");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
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

module.exports = { singleUpload };
