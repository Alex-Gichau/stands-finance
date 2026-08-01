import express from "express";
import path from "path";
import fs from "fs";
import mime from "mime-types";

const router = express.Router();
const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Express router serving files from './uploads' directory.
 * Configured with express.static middleware and custom header resolution via 'mime-types'
 * to ensure all uploaded attachments (PDFs, images, docs) are viewable and downloadable by browsers.
 */
router.use(
  express.static(uploadsDir, {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      const contentType = mime.lookup(filePath) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      const filename = path.basename(filePath);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    },
  })
);

// Direct route handler to guarantee file serving with mime-types header setup
router.get("/:filename", (req, res, next) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return next();
  }

  const contentType = mime.lookup(safeFilename) || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeFilename)}"`);
  res.setHeader("Cache-Control", "public, max-age=86400");

  return res.sendFile(filePath);
});

export default router;
