// Art direction and generation settings for the OROT camellia water cream.
//
// The page plays one continuous film: each clip runs from one still to the
// next (Seedance first and last frame), so consecutive clips meet on the same
// image and the scroll never cuts. Clip ids must match the `data-clip`
// attributes in index.html.

// Appended to every still prompt so all stills share one look.
export const style =
  'premium Korean skincare advertising photography, photorealistic, dewy and luminous, ' +
  'soft diffused high-key light from the upper left, delicate natural shadow, 100mm macro lens, ' +
  'straight-on eye-level view, the subject in sharp focus, clean minimal and airy, ' +
  'no hands, no people, no text, no lettering, no logo, no label, no watermark';

// Added to every still that is painted from earlier stills, so the camera and
// light stay locked while the subject changes.
export const continuity =
  'Keep the exact camera angle, lens, framing, subject size and position, lighting, backdrop ' +
  'and photographic style of the reference photo; change only what is described:';

// Every still and clip is rendered once per format; the page plays the format
// that matches the screen's orientation. `composition` is added to still prompts.
export const formats = {
  landscape: {
    composition:
      'wide 16:9 composition, the subject whole and about a third of the frame width, ' +
      'centred about 64% across the frame, generous empty backdrop all around it, ' +
      'the left 40% of the frame completely empty',
    imageSize: '2048x1152',
    videoResolution: '1080p-SR',
    videoRatio: '16:9',
    frameWidth: 1920,
  },
  portrait: {
    composition:
      'tall vertical 9:16 composition, the subject whole and about two thirds of the frame width, ' +
      'centred in the lower half of the frame, the upper half completely empty backdrop',
    imageSize: '1152x2048',
    videoResolution: '1080p-SR',
    videoRatio: '9:16',
    frameWidth: 1080,
  },
};

// Stills are painted in this format first; the other formats recompose them.
export const sourceFormat = 'landscape';

const BLUSH_BACKDROP =
  'against a seamless milky pale blush-pink backdrop that fills the whole frame, ' +
  'with a faint soft glossy reflection on the surface below';

const JAR =
  'a small round cream jar of thick frosted milky-white glass with a glossy pale pink lid, ' +
  'completely plain with no label';

// Key moments of the story, in order. `from` lists earlier stills used as
// references (the first one sets camera and light).
export const stills = [
  {
    id: 'bud',
    prompt:
      'A single closed pale blush-pink camellia bud on a short stem with two glossy dark green ' +
      `leaves, standing upright, ${BLUSH_BACKDROP}.`,
  },
  {
    id: 'bloom',
    from: ['bud'],
    prompt:
      'The camellia is now in full bloom: many layered translucent pale pink petals open wide ' +
      `into a large flower, and nestled in its centre sits ${JAR}, the lid closed.`,
  },
  {
    id: 'rise',
    from: ['bloom'],
    prompt:
      'The closed cream jar now floats in the air a little above the open camellia, perfectly ' +
      'level, casting a soft pink shadow onto the petals below.',
  },
  {
    id: 'open',
    from: ['rise'],
    prompt:
      'The jar still floats above the camellia, but its pale pink lid has lifted off and hovers ' +
      'tilted above and to the right of the jar, revealing a glossy whipped pale pink gel cream ' +
      'with a soft swirled peak inside.',
  },
  {
    id: 'dew',
    from: ['open'],
    prompt:
      'Crystal-clear water droplets of many sizes are now suspended in mid-air all around the ' +
      'open floating jar, catching the light like glass beads, fresh and dewy.',
  },
  {
    id: 'rest',
    from: ['dew', 'bud'],
    prompt:
      'Take the jar from the first reference and the backdrop and light of the second: the jar ' +
      'now rests closed with its pale pink lid back on, sitting on a soft bed of loose pale pink ' +
      `camellia petals with a few clear water droplets on them, ${BLUSH_BACKDROP}.`,
  },
];

// Each clip animates from one still to the next. A clip that starts where an
// earlier clip ends is animated from that clip's actual last frame, so the
// film never jumps; its `to` still guides where the motion lands.
export const clips = [
  {
    id: 'blooming',
    from: 'bud',
    to: 'bloom',
    motion:
      'The camellia bud slowly unfurls, its pale pink petals opening layer by layer into a full ' +
      'bloom that reveals the cream jar resting in its heart.',
  },
  {
    id: 'rising',
    from: 'bloom',
    to: 'rise',
    motion: 'The cream jar gently lifts out of the flower and floats upward, hovering weightlessly.',
  },
  {
    id: 'opening',
    from: 'rise',
    to: 'open',
    motion:
      'The lid slowly lifts and tilts away from the floating jar, revealing the glossy whipped ' +
      'cream inside.',
  },
  {
    id: 'misting',
    from: 'open',
    to: 'dew',
    motion:
      'A fine burst of clear water droplets blooms outward around the floating jar and slows to ' +
      'hang in the air, glistening.',
  },
  {
    id: 'settling',
    from: 'dew',
    to: 'rest',
    motion:
      'The droplets drift down, the lid settles back onto the jar, and the jar slowly lowers onto ' +
      'a soft bed of camellia petals as the flower falls apart around it.',
  },
];

const PRODUCT_SHOT =
  'centred on a seamless milky pale blush-pink backdrop with a faint glossy reflection, a single ' +
  'pale pink camellia petal lying beside it, premium Korean skincare product photography, ' +
  'soft diffused high-key light, photorealistic, completely plain packaging with no label, ' +
  'no text, no lettering, no logo, no watermark.';

// Single images used as page decoration (not part of the film), written to
// src/assets/<id>.webp.
export const extras = [
  {
    id: 'product-toner',
    size: '1024x1536',
    width: 720,
    prompt:
      'A tall slim bottle of clear glass filled with a transparent pale pink toner, with a ' +
      `glossy pale pink cap, ${PRODUCT_SHOT}`,
  },
  {
    id: 'product-serum',
    size: '1024x1536',
    width: 720,
    prompt:
      'A small frosted milky-white glass serum bottle with a pale pink rubber dropper top, ' +
      `${PRODUCT_SHOT}`,
  },
  {
    id: 'product-cream',
    size: '1024x1536',
    width: 720,
    prompt: `A small round cream jar of thick frosted milky-white glass with a glossy pale pink lid, ${PRODUCT_SHOT}`,
  },
  {
    id: 'product-mist',
    size: '1024x1536',
    width: 720,
    prompt:
      'A slim frosted milky-white glass facial mist spray bottle with a pale pink fine-mist ' +
      `pump, ${PRODUCT_SHOT}`,
  },
];

export const imageSettings = {
  model: 'openai/gpt-image-2.5-flare/text-to-image',
  editModel: 'openai/gpt-image-2.5-flare/edit',
  quality: 'high',
};

export const videoSettings = {
  model: 'bytedance/seedance-2.0-mini/image-to-video',
  duration: 5,
  generateAudio: false,
  // Appended to every clip's motion prompt.
  motionStyle:
    'Static locked-off camera, slow graceful weightless motion. No hands, no people and no ' +
    'tools ever appear; the flower, jar and water move by themselves. The jar stays frosted ' +
    'milky-white glass and its lid stays glossy pale pink throughout, never metallic.',
};

// Scroll playback frames written to src/assets/clips/<id>/<format>/.
export const frameSettings = {
  fps: 24,
  quality: 80,
};

// Atlas Cloud list prices (October 2026), used only for the pre-run estimate.
// Check https://www.atlascloud.ai/models for current rates.
export const estimatePricing = {
  imageUsd: 0.03,
  videoUsdPerSecond: 0.045,
};
