// build-and-upload-micro.mjs
// Node 18+ and `arduino-cli` in PATH required.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const FQBN = "arduino:avr:micro";
const BLINK_INO = `\
void setup(){ pinMode(LED_BUILTIN, OUTPUT); }
void loop(){ digitalWrite(LED_BUILTIN, HIGH); delay(500); digitalWrite(LED_BUILTIN, LOW); delay(500); }
`;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore","pipe","pipe"], ...opts });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("close", code => code === 0
      ? resolve({ stdout, stderr })
      : reject(Object.assign(new Error(`${cmd} ${args.join(" ")} exited ${code}`), { code, stdout, stderr })));
  });
}

async function ensureCore() {
  console.log("→ Updating core index…");
  await run("arduino-cli", ["core", "update-index"]);
  console.log("→ Ensuring core arduino:avr is installed…");
  await run("arduino-cli", ["core", "install", "arduino:avr"]);
}

async function createSketch() {
  const base = path.join(os.tmpdir(), `micro-blink-${crypto.randomUUID()}`);
  const sketchDir = path.join(base, "BlinkMicro");
  await fs.mkdir(sketchDir, { recursive: true });
  await fs.writeFile(path.join(sketchDir, "BlinkMicro.ino"), BLINK_INO, "utf8");
  return sketchDir;
}

async function compileSketch(sketchDir) {
  console.log("→ Compiling sketch for Arduino Micro…");
  const { stdout, stderr } = await run("arduino-cli", ["compile", "--fqbn", FQBN, "--export-binaries", sketchDir]);
  process.stdout.write(stdout); process.stderr.write(stderr);
}

function normalizePorts(json) {
  // Support both modern "detected_ports" and older "ports" layouts.
  if (!json) return [];
  if (Array.isArray(json.detected_ports)) return json.detected_ports.map(e => ({
    address: e.port?.address,
    label: e.port?.label,
    protocol: e.port?.protocol,
    protocol_label: e.port?.protocol_label,
    properties: e.port?.properties || {},
    matching_boards: e.matching_boards || [],
  }));
  if (Array.isArray(json.ports)) return json.ports.map(e => ({
    address: e.address,
    label: e.label,
    protocol: e.protocol,
    protocol_label: e.protocol_label,
    properties: e.properties || {},
    matching_boards: e.boards || [],
  }));
  return [];
}

function pickMicroPort(entries) {
  // 1) Exact matching board name/FQBN
  const exact = entries.find(e =>
    (e.matching_boards || []).some(b =>
      (b.fqbn || "").toLowerCase() === "arduino:avr:micro" ||
      (b.name || "").toLowerCase().includes("arduino micro")
    )
  );
  if (exact?.address) return exact.address;

  // 2) Vendor ID typical for Arduino (0x2341 / 0x2A03)
  const byVid = entries.find(e => {
    const vid = (e.properties?.vid || e.properties?.VID || "").toLowerCase();
    return vid === "0x2341" || vid === "0x2a03";
  });
  if (byVid?.address) return byVid.address;

  // 3) Common macOS device naming
  const byName = entries.find(e => (e.address || "").includes("usbmodem"));
  if (byName?.address) return byName.address;

  // 4) Last resort: first serial USB entry
  return entries[0]?.address || null;
}

async function detectPort(preferredPort) {
  if (preferredPort) {
    console.log(`→ Using provided port: ${preferredPort}`);
    return preferredPort;
  }
  console.log("→ Detecting Arduino Micro serial port…");
  const { stdout } = await run("arduino-cli", ["board", "list", "--format", "json"]);
  let data;
  try { data = JSON.parse(stdout); }
  catch { throw new Error("Failed to parse `arduino-cli board list` JSON."); }

  const entries = normalizePorts(data);
  if (!entries.length) {
    // Helpful debug printout
    console.error("Raw `arduino-cli board list` output:\n", stdout);
    throw new Error("No serial ports found. Plug in the board and try again.");
  }

  const addr = pickMicroPort(entries);
  if (!addr) {
    console.error("Raw `arduino-cli board list` output:\n", stdout);
    throw new Error("Could not determine a serial port for the Arduino Micro.");
  }
  console.log(`→ Chosen port: ${addr}`);
  return addr;
}

async function upload(sketchDir, port) {
  console.log("→ Uploading…");
  const { stdout, stderr } = await run("arduino-cli", ["upload", "-p", port, "--fqbn", FQBN, sketchDir]);
  process.stdout.write(stdout); process.stderr.write(stderr);
  console.log("✓ Upload complete.");
}

async function main() {
  try {
    // Verify CLI exists
    try { await run("arduino-cli", ["version"]); }
    catch {
      console.error("arduino-cli not found. Install and ensure it’s in PATH.");
      console.error("Install guide: https://arduino.github.io/arduino-cli/latest/installation/");
      process.exit(1);
    }

    await ensureCore();
    const sketchDir = await createSketch();
    console.log(`→ Sketch directory: ${sketchDir}`);
    await compileSketch(sketchDir);

    const preferredPort = process.argv[2] || process.env.PORT;
    const port = await detectPort(preferredPort);

    await upload(sketchDir, port);
    console.log("\nDone! The onboard LED should be blinking.");
  } catch (err) {
    console.error("\n✗ Error:", err.message || err);
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    process.exit(1);
  }
}

await main();
