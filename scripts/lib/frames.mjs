// Converts generated media into the WebP files the page loads.

import { spawn } from 'node:child_process';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const FRAME_PATTERN = /^frame_\d{4}\.webp$/;

export const clipsDir = path.resolve('src/assets/clips');

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    ffmpeg.on('error', (error) => {
      reject(
        error.code === 'ENOENT'
          ? new Error('ffmpeg was not found on PATH. Install it from https://ffmpeg.org/')
          : error,
      );
    });
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

// Removes only files this module produces, so the folder can hold anything else.
async function clearPreviousFrames(outDir) {
  const entries = await readdir(outDir);
  await Promise.all(
    entries.filter((name) => FRAME_PATTERN.test(name)).map((name) => rm(path.join(outDir, name))),
  );
}

export async function extractFrames(input, outDir, { fps, width, quality }) {
  if (!(await stat(input)).isFile()) {
    throw new Error(`Input is not a file: ${input}`);
  }

  await mkdir(outDir, { recursive: true });
  await clearPreviousFrames(outDir);

  await runFfmpeg([
    '-hide_banner',
    '-loglevel', 'error',
    '-i', input,
    '-vf', `fps=${fps},scale=${width}:-2:flags=lanczos`,
    '-an',
    '-c:v', 'libwebp',
    '-quality', String(quality),
    '-compression_level', '4',
    path.join(outDir, 'frame_%04d.webp'),
  ]);

  const count = (await readdir(outDir)).filter((name) => FRAME_PATTERN.test(name)).length;
  if (count === 0) {
    throw new Error('ffmpeg produced no frames');
  }
  return count;
}

// Converts a single still into a resized WebP.
export async function convertImage(input, output, { width, quality }) {
  await mkdir(path.dirname(output), { recursive: true });
  await runFfmpeg([
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', input,
    '-vf', `scale=${width}:-2:flags=lanczos`,
    '-c:v', 'libwebp',
    '-quality', String(quality),
    output,
  ]);
}

// Saves the final frame of a video as a PNG.
export async function extractLastFrame(input, output) {
  await mkdir(path.dirname(output), { recursive: true });
  await runFfmpeg([
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-sseof', '-1',
    '-i', input,
    '-update', '1',
    output,
  ]);
}
