import express from "express";
import cors from "cors";
import { execFileSync } from "node:child_process";
import { rm, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from 'node:util';
import { promises as fs } from "node:fs";

const app = express();
app.use(cors());
app.use(express.json())
const PORT = 3000;

// Parse JSON bodies
app.use(express.json());

async function ensureEmptyTempFolder(name) {
  if (!name || typeof name !== "string") {
    throw new TypeError("name must be a non-empty string");
  }
  const dir = join(tmpdir(), name);

  // Remove the directory if it exists (force ignores "doesn't exist" errors)
  await rm(dir, { recursive: true, force: true });

  // Recreate it fresh (700 so only the current user can read/write/execute)
  await mkdir(dir, { recursive: true, mode: 0o700 });

  return dir;
}

// Example API route
app.post("/api/upload-sketch", async (req, res) => {
  console.log("starting sketch upload...");
  try {
    const { inoText } = req.body || {};
    if (typeof inoText !== "string" || inoText.trim() === "") {
      return res.status(400).json({ success: false, error: "Missing inoText" });
    }

    const sketchDir = await ensureEmptyTempFolder("Tmp96PlateSketchDir");
    const sketchPath = join(sketchDir, "TmpSketch");

    // Create a new sketch folder + template .ino
    const newOut = execFileSync("arduino-cli", ["sketch", "new", sketchPath], { encoding: "utf8" });
    console.log(newOut);

    // Overwrite the template .ino with the provided text
    const inoFilePath = join(sketchPath, `${basename(sketchPath)}.ino`);
    await fs.writeFile(inoFilePath, inoText.endsWith("\n") ? inoText : `${inoText}\n`, "utf8");

    // Compile & upload
    const compileOut = execFileSync("arduino-cli", ["compile", "-b", "arduino:avr:nano", sketchPath], { encoding: "utf8" });
    console.log(compileOut);

    const uploadOut = execFileSync("arduino-cli", ["upload", "-p", "COM5", "-b", "arduino:avr:nano", sketchPath], { encoding: "utf8" });
    console.log(uploadOut);

    console.log("success!");

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err?.stderr || err?.message || err) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
