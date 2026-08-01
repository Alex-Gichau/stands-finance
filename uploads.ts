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
 * Uses 'mime-types' to dynamically set the correct Content-Type header.
 */
router.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Attachment file not found");
  }

  const contentType = mime.lookup(safeFilename) || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeFilename)}"`);
  res.setHeader("Cache-Control", "public, max-age=86400");

  return res.sendFile(filePath);
});

export default router;
