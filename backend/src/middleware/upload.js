const multer = require("multer");
const { isAllowedUpload } = require("../services/uploadService");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    fieldNestingDepth: 1,
    fields: 20,
  },
  fileFilter(req, file, cb) {
    const mime = file.mimetype || "application/octet-stream";
    const originalName = file.originalname || "file";
    if (!isAllowedUpload(mime, originalName)) {
      return cb(new Error("File type not allowed"));
    }
    cb(null, true);
  },
});

function singleUpload(fieldName = "file") {
  return upload.single(fieldName);
}

function multiUpload(fieldName = "files", maxCount = 10) {
  return upload.array(fieldName, maxCount);
}

module.exports = { singleUpload, multiUpload };
