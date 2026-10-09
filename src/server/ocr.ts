import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { WordsResponse } from "@/lib/api-types";

const execFileAsync = promisify(execFile);
const SCRIPT_SOURCE = join(process.cwd(), "scripts", "ocr-words.swift");
const SCRIPT_BIN = join(process.cwd(), "scripts", "ocr-words");

let compileAttempted = false;
let compiledOk = false;

/** Compiles scripts/ocr-words.swift on first use. Skips gracefully if swiftc is missing. */
async function ensureCompiled(): Promise<boolean> {
  if (compileAttempted) return compiledOk;
  compileAttempted = true;

  try {
    await access(SCRIPT_BIN, constants.X_OK);
    compiledOk = true;
    return true;
  } catch {
    // not yet compiled, fall through
  }

  try {
    await execFileAsync("swiftc", ["-O", SCRIPT_SOURCE, "-o", SCRIPT_BIN]);
    compiledOk = true;
  } catch (err) {
    console.error("[ocr] swiftc compile failed or is not installed; word boxes unavailable", err);
    compiledOk = false;
  }
  return compiledOk;
}

/** Word-level OCR via Apple Vision, in the image's own pixel coordinates. Optional step 8 feature. */
export async function ocrWords(imagePath: string): Promise<WordsResponse | null> {
  const ok = await ensureCompiled();
  if (!ok) return null;

  try {
    const { stdout } = await execFileAsync(SCRIPT_BIN, [imagePath], { maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout) as WordsResponse;
  } catch (err) {
    console.error(`[ocr] ocr-words failed for ${imagePath}`, err);
    return null;
  }
}
