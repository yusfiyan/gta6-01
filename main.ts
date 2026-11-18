// Marisol Bay — the hand-in program for the gta6-01 bounty (Node 22, stdlib
// only). It stages the finished game for the grader: game/ and screenshots/
// are copied into the output directory, then /output/dossier.json is written
// with the kit's buildDossier library, and the result is checked before the
// program reports success. The game itself is plain static files —
// game/index.html and its ES modules — that play in desktop Chrome with no
// network request at all.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the repository lives, and where the graded files go.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own limits (gate): game/ at most 993 files and 48 MiB,
// index.html at most 1 MiB, 3-4 screenshots at most 256 KiB each.
const GAME_FILE_LIMIT = 993;
const GAME_BYTE_LIMIT = 48 * 1024 * 1024;
const SHOT_LIMIT = 4;
const SHOT_BYTE_LIMIT = 256 * 1024;

function fail(message) {
  process.stderr.write(`main.ts: ${message}\n`);
  process.exit(1);
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function countGameFiles(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countGameFiles(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += readFileSync(path).length;
    } else {
      fail(`game/ holds a non-file entry: ${path}`);
    }
  }
  return { files, bytes };
}

// 1. Copy the game and its screenshots into the output directory.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// 2. Write the dossier the judge reads.
// buildDossier returns canonical JSON *bytes* (a Uint8Array), not a string:
// JSON.parse on the raw value would see "123,34,99,..." (a typed array's
// comma-joined toString) and die at position 3, so decode it explicitly.
const dossierText = Buffer.from(buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: SHOT_LIMIT, max_bytes: SHOT_BYTE_LIMIT },
  game_max_files: GAME_FILE_LIMIT,
  game_max_bytes: GAME_BYTE_LIMIT,
  game_path_max_bytes: 1000,
})).toString('utf8');
writeFileSync(join(outputDir, 'dossier.json'), dossierText);

// 3. Verify the staged output, so a broken hand-in fails loudly here
//    instead of quietly on the grader.
const gameDir = join(outputDir, 'game');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing from /output');
const gameTotals = countGameFiles(gameDir);
if (gameTotals.files > GAME_FILE_LIMIT) {
  fail(`game/ has ${gameTotals.files} files, over the ${GAME_FILE_LIMIT} cap`);
}
if (gameTotals.bytes > GAME_BYTE_LIMIT) {
  fail(`game/ is ${gameTotals.bytes} bytes, over the 48 MiB cap`);
}
const indexBytes = readFileSync(join(gameDir, 'index.html')).length;
if (indexBytes > 1024 * 1024) fail(`game/index.html is ${indexBytes} bytes, over the 1 MiB cap`);

const shotDir = join(outputDir, 'screenshots');
const shotNames = existsSync(shotDir)
  ? readdirSync(shotDir).filter((name) => !name.startsWith('.')).sort()
  : [];
if (shotNames.length < 3 || shotNames.length > SHOT_LIMIT) {
  fail(`screenshots/ holds ${shotNames.length} images, need 3 or 4`);
}
for (const name of shotNames) {
  const bytes = readFileSync(join(shotDir, name));
  if (bytes.length > SHOT_BYTE_LIMIT) fail(`screenshot ${name} is ${bytes.length} bytes, over the 256 KiB cap`);
}
const dossier = JSON.parse(dossierText);
const dossierImages = dossier?.images ?? dossier?.screenshots ?? [];
if (dossierImages.length !== shotNames.length) {
  fail(`dossier.json lists ${dossierImages.length} images but screenshots/ holds ${shotNames.length}`);
}
// The cover is the first screenshot by name; every image's hash must be the
// one the dossier recorded for it, in the same order.
shotNames.forEach((name, index) => {
  const bytes = readFileSync(join(shotDir, name));
  const digest = sha256Hex(bytes);
  const recorded = dossierImages[index]?.sha256 ?? dossierImages[index]?.hash ?? '';
  if (recorded && recorded !== digest) fail(`dossier hash mismatch for screenshot ${name}`);
});
if (shotNames.length > 0) {
  const coverName = shotNames[0];
  const coverEntry = dossierImages[0]?.name ?? dossierImages[0]?.filename ?? '';
  if (coverEntry && coverEntry !== coverName) fail(`dossier cover is ${coverEntry}, expected ${coverName}`);
}

process.stdout.write(
  `main.ts: Marisol Bay staged — game/ ${gameTotals.files} files, ${gameTotals.bytes} bytes; ` +
  `${shotNames.length} screenshots, cover ${shotNames[0] ?? 'none'}; dossier.json ${dossierText.length} bytes\n`,
);
