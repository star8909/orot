// Generates the story with Atlas Cloud, once per format (see `formats` in
// story.config.mjs): the key stills (GPT Image 2.5), the clips that run from
// one still to the next (Seedance 2.0 Mini first and last frame), the scroll
// frame sequences and the decorative extras.
// A clip that continues an earlier clip starts from that clip's actual last
// frame, so it is regenerated whenever the earlier clip changes.
// Paid results are cached in generated/ and skipped unless --force.
//
// Usage: npm run generate -- [--format landscape,portrait]
//                            [--step image,video,frames] [--force] [--yes]

import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  clips,
  continuity,
  estimatePricing,
  extras,
  formats,
  frameSettings,
  imageSettings,
  sourceFormat,
  stills,
  style,
  videoSettings,
} from '../story.config.mjs';
import { AtlasClient, download } from './lib/atlas-client.mjs';
import { clipsDir, convertImage, extractFrames, extractLastFrame } from './lib/frames.mjs';

const STEPS = ['image', 'video', 'frames'];
const generatedDir = path.resolve('generated');
const assetsDir = path.resolve('src/assets');

const { values } = parseArgs({
  options: {
    format: { type: 'string' },
    step: { type: 'string' },
    force: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
  },
});

function parseList(raw, allowed, flag) {
  const items = raw.split(',').map((item) => item.trim());
  const unknown = items.filter((item) => !allowed.includes(item));
  if (unknown.length > 0) {
    throw new Error(`Unknown ${flag} value(s): ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`);
  }
  return items;
}

// Catches typos in still references before any money is spent.
function validateConfig() {
  const ids = stills.map((still) => still.id);
  stills.forEach((still, index) => {
    for (const ref of still.from ?? []) {
      if (!ids.slice(0, index).includes(ref)) {
        throw new Error(`Still "${still.id}" references "${ref}", which is not an earlier still`);
      }
    }
  });
  for (const clip of clips) {
    for (const end of [clip.from, clip.to]) {
      if (!ids.includes(end)) throw new Error(`Clip "${clip.id}" uses unknown still "${end}"`);
    }
  }
  if (!(sourceFormat in formats)) {
    throw new Error(`sourceFormat "${sourceFormat}" is not one of the configured formats`);
  }
}

// The source format always comes first: the other formats are recomposed from it.
function selectFormats() {
  const names = Object.keys(formats);
  const selected = values.format ? parseList(values.format, names, '--format') : names;
  return selected.sort((a, b) => Number(b === sourceFormat) - Number(a === sourceFormat));
}

const stillPath = (id, format) => path.join(generatedDir, 'stills', format, `${id}.png`);
const clipPath = (id, format) => path.join(generatedDir, 'clips', format, `${id}.mp4`);
const lastFramePath = (id, format) => path.join(generatedDir, 'clips', format, `${id}.last.png`);
const extraPath = (id) => path.join(generatedDir, 'extras', `${id}.png`);

const isPending = (file) => values.force || !existsSync(file);

// The earlier clip that ends on the still this clip starts from, if any.
const predecessorOf = (clip) =>
  clips.slice(0, clips.indexOf(clip)).findLast((other) => other.to === clip.from);

// Clips (in order) that need rendering: missing ones, and any clip whose
// predecessor is being re-rendered or was rendered after it.
function pendingClips(format) {
  const pending = new Set();
  for (const clip of clips) {
    const file = clipPath(clip.id, format);
    const predecessor = predecessorOf(clip);
    const stale =
      predecessor &&
      (pending.has(predecessor) ||
        (existsSync(file) &&
          statSync(clipPath(predecessor.id, format)).mtimeMs > statSync(file).mtimeMs));
    if (isPending(file) || stale) pending.add(clip);
  }
  return [...pending];
}

// Lists the paid calls this run will make so the user can approve the cost.
function planRun(selectedFormats, steps) {
  const images = steps.includes('image')
    ? selectedFormats.flatMap((format) => stills.map((still) => stillPath(still.id, format)))
        .concat(extras.map((extra) => extraPath(extra.id)))
        .filter(isPending).length
    : 0;
  const videos = steps.includes('video')
    ? selectedFormats.reduce((count, format) => count + pendingClips(format).length, 0)
    : 0;
  const cost =
    images * estimatePricing.imageUsd +
    videos * videoSettings.duration * estimatePricing.videoUsdPerSecond;
  return { images, videos, cost };
}

// References are uploaded once per run and reused.
function createUploader(client) {
  const uploads = new Map();
  return (filePath) => {
    if (!uploads.has(filePath)) uploads.set(filePath, client.upload(filePath));
    return uploads.get(filePath);
  };
}

function requireFile(file, hint) {
  if (!existsSync(file)) throw new Error(`Missing ${path.relative('.', file)}: ${hint}`);
  return file;
}

async function generateStill(client, upload, still, format) {
  const { composition, imageSize } = formats[format];
  const prompt = `${still.prompt} ${composition}, ${style}`;
  const common = { size: imageSize, quality: imageSettings.quality, output_format: 'png', n: 1 };

  let request;
  if (format !== sourceFormat) {
    // Same moment, new frame shape: recompose the source-format still.
    const source = requireFile(stillPath(still.id, sourceFormat), `generate the ${sourceFormat} still first`);
    request = {
      model: imageSettings.editModel,
      images: [await upload(source)],
      prompt:
        'Recompose the reference photo for a new frame shape: keep the same subject, backdrop, ' +
        `lighting and photographic style, and extend the backdrop naturally. ${prompt}`,
    };
  } else if (still.from) {
    const references = still.from.map((id) =>
      requireFile(stillPath(id, format), `still "${id}" comes before "${still.id}"`),
    );
    request = {
      model: imageSettings.editModel,
      images: await Promise.all(references.map(upload)),
      prompt: `${continuity} ${prompt}`,
    };
  } else {
    request = { model: imageSettings.model, prompt };
  }

  const [url] = await client.generate('generateImage', { ...common, ...request });
  await download(url, stillPath(still.id, format));
}

async function generateClip(client, upload, clip, format) {
  const { videoResolution, videoRatio } = formats[format];
  const hint = 'run the image step first';
  const predecessor = predecessorOf(clip);
  let first = stillPath(clip.from, format);
  if (predecessor) {
    first = lastFramePath(predecessor.id, format);
    await extractLastFrame(requireFile(clipPath(predecessor.id, format), 'render clips in order'), first);
  }
  const [url] = await client.generate('generateVideo', {
    model: videoSettings.model,
    prompt: `${clip.motion} ${videoSettings.motionStyle}`,
    image: await upload(requireFile(first, hint)),
    last_image: await upload(requireFile(stillPath(clip.to, format), hint)),
    duration: videoSettings.duration,
    resolution: videoResolution,
    ratio: videoRatio,
    generate_audio: videoSettings.generateAudio,
    watermark: false,
  });
  await download(url, clipPath(clip.id, format));
}

async function generateExtra(client, extra) {
  const [url] = await client.generate('generateImage', {
    model: imageSettings.model,
    prompt: extra.prompt,
    size: extra.size,
    quality: imageSettings.quality,
    output_format: 'png',
    n: 1,
  });
  await download(url, extraPath(extra.id));
}

async function main() {
  validateConfig();
  const selectedFormats = selectFormats();
  const steps = values.step ? parseList(values.step, STEPS, '--step') : STEPS;
  const plan = planRun(selectedFormats, steps);

  console.log(`Formats: ${selectedFormats.join(', ')}`);
  console.log(`Steps: ${steps.join(', ')}`);
  console.log(
    `Paid calls: ${plan.images} image(s), ${plan.videos} video(s) × ${videoSettings.duration}s ` +
      `— estimated $${plan.cost.toFixed(2)}`,
  );

  const needsApi = plan.images + plan.videos > 0;
  if (needsApi && !values.yes) {
    console.log('Nothing generated. Re-run with --yes to spend the estimated amount.');
    return;
  }

  const client = needsApi ? new AtlasClient(process.env.ATLASCLOUD_API_KEY) : null;
  const upload = needsApi ? createUploader(client) : null;

  for (const dir of ['stills', 'clips'].flatMap((kind) =>
    selectedFormats.map((format) => path.join(generatedDir, kind, format)),
  )) {
    await mkdir(dir, { recursive: true });
  }
  await mkdir(path.join(generatedDir, 'extras'), { recursive: true });

  if (steps.includes('image')) {
    // Stills are chained (each is painted from earlier ones), so they run in order.
    for (const format of selectedFormats) {
      for (const still of stills) {
        if (!isPending(stillPath(still.id, format))) continue;
        console.log(`[${still.id}/${format}] painting still…`);
        await generateStill(client, upload, still, format);
      }
    }
    for (const extra of extras) {
      if (!isPending(extraPath(extra.id))) continue;
      console.log(`[${extra.id}] painting extra…`);
      await generateExtra(client, extra);
    }
  }

  if (steps.includes('video')) {
    // Chained clips render in order within a format; formats run in parallel.
    await Promise.all(
      selectedFormats.map(async (format) => {
        for (const clip of pendingClips(format)) {
          console.log(`[${clip.id}/${format}] animating clip…`);
          await generateClip(client, upload, clip, format);
          console.log(`[${clip.id}/${format}] clip ready`);
        }
      }),
    );
  }

  if (steps.includes('frames')) {
    for (const format of selectedFormats) {
      for (const clip of clips) {
        const video = requireFile(clipPath(clip.id, format), 'run the video step first');
        const count = await extractFrames(video, path.join(clipsDir, clip.id, format), {
          ...frameSettings,
          width: formats[format].frameWidth,
        });
        console.log(`[${clip.id}/${format}] ${count} frames ready`);
      }
    }
    for (const extra of extras) {
      const still = requireFile(extraPath(extra.id), 'run the image step first');
      await convertImage(still, path.join(assetsDir, `${extra.id}.webp`), {
        width: extra.width,
        quality: frameSettings.quality,
      });
      console.log(`[${extra.id}] image ready`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
