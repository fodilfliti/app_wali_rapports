const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const {
  isAllowedUpload,
  ensureUploadTempDir,
  cleanupTempFile,
} = require("../services/uploadService");

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      try {
        cb(null, ensureUploadTempDir());
      } catch (err) {
        cb(err);
      }
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname || "").slice(0, 12).toLowerCase();
      cb(null, `${crypto.randomUUID().replace(/-/g, "")}${ext || ".bin"}`);
    },
  }),
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
  return (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) return next(err);
      if (req.file?.path) req.uploadStartedAt = Date.now();
      next();
    });
  };
}

function multiUpload(fieldName = "files", maxCount = 10) {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) return next(err);
      if (req.files?.length) req.uploadStartedAt = Date.now();
      next();
    });
  };
}

function optionalSingleUpload(fieldName = "file") {
  return (req, res, next) => {
    if (req.is("multipart/form-data")) return singleUpload(fieldName)(req, res, next);
    return next();
  };
}

function optionalMultiUpload(fieldName = "files", maxCount = 10) {
  return (req, res, next) => {
    if (req.is("multipart/form-data")) return multiUpload(fieldName, maxCount)(req, res, next);
    return next();
  };
}

async function discardMulterFiles(req) {
  const files = req.file ? [req.file] : req.files || [];
  for (const f of files) {
    if (f?.path) await cleanupTempFile(f.path);
  }
}

function multerErrorHandler(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Too many files" });
    }
    return res.status(400).json({ error: err.message || "Upload failed" });
  }
  if (String(err.message || "").includes("File type not allowed")) {
    void discardMulterFiles(req);
    return res.status(400).json({ error: "File type not allowed" });
  }
  void discardMulterFiles(req);
  next(err);
}

module.exports = {
  singleUpload,
  multiUpload,
  optionalSingleUpload,
  optionalMultiUpload,
  multerErrorHandler,
  discardMulterFiles,
};