import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import './style.css';
import { CanvasRenderer } from './film/canvas-renderer.js';
import { FrameLoader } from './film/frame-loader.js';
import { SceneTrack } from './film/scene-track.js';
import { setupCart, setupSkinFilter } from './shop/lineup.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Frames written by `npm run generate`, resolved at build time and grouped by
// clip and format folder in file-name order:
// src/assets/clips/<clip>/<format>/frame_0001.webp
const frameModules = import.meta.glob('./assets/clips/*/*/frame_*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const FRAMES = Object.keys(frameModules)
  .sort()
  .reduce((frames, key) => {
    const [clip, format] = key.split('/').slice(-3, -1);
    ((frames[clip] ??= {})[format] ??= []).push(frameModules[key]);
    return frames;
  }, {});

// Portrait screens play the 9:16 renders, every other screen the 16:9 ones.
const FORMATS = ['landscape', 'portrait'];
const portraitQuery = window.matchMedia('(orientation: portrait)');
const currentFormat = () => (portraitQuery.matches ? 'portrait' : 'landscape');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One track per clip, in chapter order. A clip missing the requested format
// plays whichever format it has, so a partially generated set still plays.
function createTracks(clipIds, format) {
  return clipIds.map((id) => {
    const available = FRAMES[id] ?? {};
    const used = available[format] ? format : FORMATS.find((other) => available[other]);
    if (used !== format) {
      console.warn(
        `Clip "${id}" has no ${format} frames yet${used ? `; playing ${used}` : ''}. ` +
          `Run: npm run generate -- --format ${format}`,
      );
    }
    return new SceneTrack(id, used ? available[used] : [], 0.5);
  });
}

function setupSmoothScroll() {
  if (prefersReducedMotion) return null;

  const lenis = new Lenis({ anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

// Each chapter spans 'top top' to 'bottom top', so the chapters tile the
// scroll without gaps. The last one ends at the bottom of the page instead:
// the footer is shorter than a screen, so its 'bottom top' is never reached
// and its progress segment would never fill. A chapter is current from its
// first pixel, so a jump to a chapter's exact start shows that chapter.
function createChapterTriggers(chapters) {
  return chapters.map((chapter, index) =>
    ScrollTrigger.create({
      trigger: chapter,
      start: 'top top',
      end: index === chapters.length - 1 ? 'max' : 'bottom top',
    }),
  );
}

const currentChapter = (triggers) =>
  Math.max(0, triggers.findLastIndex((trigger) => trigger.scroll() >= trigger.start));

// Each clip chapter scrubs its clip; chapters after the last clip hold its
// final frame.
function createFilm(triggers, renderer) {
  let tracks = [];

  return {
    useTracks(next) {
      tracks = next;
    },
    // Draws the frame for `chapter` and returns the index of the clip shown.
    render(chapter) {
      if (tracks.length === 0) return 0;
      const trackIndex = Math.min(chapter, tracks.length - 1);
      const progress = chapter < tracks.length ? triggers[chapter].progress : 1;
      renderer.draw(tracks[trackIndex].frameAt(progress));
      return trackIndex;
    },
  };
}

// Shows one chapter's copy at a time, in the same place and over the same
// scroll range as its clip, and mirrors the chapter's copy alignment
// on the root element for the scrim. Each chapter has a
// progress segment that fills as its clip plays. Returns the per-frame update.
function setupChapters(chapters, triggers, lenis) {
  const copies = gsap.utils.toArray('[data-copy]');
  if (copies.length !== chapters.length) {
    throw new Error(`Found ${copies.length} [data-copy] blocks for ${chapters.length} chapters`);
  }

  const progress = document.querySelector('[data-progress]');
  const steps = chapters.map((chapter, index) => {
    const step = document.createElement('button');
    step.type = 'button';
    step.className = 'progress__step';
    step.setAttribute('aria-label', copies[index].querySelector('.chapter__title').innerText.replace(/\s+/g, ' '));
    step.append(Object.assign(document.createElement('span'), { className: 'progress__fill' }));
    step.addEventListener('click', () => {
      const top = triggers[index].start;
      if (lenis) lenis.scrollTo(top, { duration: 1.6 });
      else window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
    progress.append(step);
    return step;
  });
  const fills = steps.map((step) => step.firstElementChild);
  const filled = fills.map(() => null);

  gsap.set(copies.slice(1), { autoAlpha: 0 });

  const reveals = copies.map((copy) => {
    const parts = copy.querySelectorAll('.eyebrow, .chapter__body, .chapter__facts li, .chapter__actions');
    const split = SplitText.create(copy.querySelector('[data-lines]'), {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
    });
    return () => {
      if (prefersReducedMotion) return;
      gsap.fromTo(split.lines, { yPercent: 100 }, { yPercent: 0, duration: 1, stagger: 0.08, ease: 'expo.out' });
      gsap.fromTo(parts, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, delay: 0.15, ease: 'power3.out' });
    };
  });

  let active = 0;
  const activate = (index) => {
    if (index === active) return;
    gsap.to(copies[active], { autoAlpha: 0, duration: 0.35, ease: 'power2.out', overwrite: true });
    gsap.to(copies[index], { autoAlpha: 1, duration: 0.35, ease: 'power2.out', overwrite: true });
    reveals[index]();
    steps[active].removeAttribute('aria-current');
    steps[index].setAttribute('aria-current', 'step');
    document.documentElement.dataset.align = chapters[index].dataset.align ?? 'left';
    active = index;
  };
  steps[0].setAttribute('aria-current', 'step');
  reveals[0]();

  return (chapter) => {
    triggers.forEach((trigger, index) => {
      if (trigger.progress === filled[index]) return;
      filled[index] = trigger.progress;
      gsap.set(fills[index], { scaleX: trigger.progress });
    });
    activate(chapter);
  };
}

// The scroll cue fades out with the first swipe and returns at the top.
function animateScrollHint() {
  gsap.to('[data-scroll-hint]', {
    autoAlpha: 0,
    ease: 'none',
    scrollTrigger: { trigger: '[data-clip]', start: 'top top', end: '8% top', scrub: true },
  });
}

async function init() {
  await document.fonts.ready;

  const chapters = gsap.utils.toArray('.chapter');
  const clipIds = chapters.map((chapter) => chapter.dataset.clip).filter(Boolean);
  const loadersByFormat = new Map();
  const loaderFor = (format) => {
    if (!loadersByFormat.has(format)) {
      loadersByFormat.set(format, new FrameLoader(createTracks(clipIds, format)));
    }
    return loadersByFormat.get(format);
  };

  const triggers = createChapterTriggers(chapters);
  const film = createFilm(triggers, new CanvasRenderer(document.querySelector('[data-film]')));
  let loader = loaderFor(currentFormat());
  film.useTracks(loader.tracks);
  loader.start();

  // Rotating the device switches to the other format's frames, which then
  // get the network to themselves.
  portraitQuery.addEventListener('change', () => {
    loader.pause();
    loader = loaderFor(currentFormat());
    film.useTracks(loader.tracks);
    loader.start();
  });

  const lenis = setupSmoothScroll();
  const updateChapters = setupChapters(chapters, triggers, lenis);
  gsap.ticker.add(() => {
    const chapter = currentChapter(triggers);
    loader.focus(film.render(chapter));
    updateChapters(chapter);
  });
  setupSkinFilter(document.querySelector('#lineup'));
  setupCart(document);
  animateScrollHint();
}

init();
