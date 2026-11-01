// One scene's frame sequence: loads frames on request and returns the frame
// nearest to a playback position, falling back to the closest frame that has
// finished loading.

export class SceneTrack {
  constructor(id, urls, focusX) {
    this.id = id;
    this.urls = urls;
    this.images = new Array(urls.length).fill(null);
    this.requested = new Set();
    this.focusX = focusX;
  }

  get isEmpty() {
    return this.urls.length === 0;
  }

  get lastIndex() {
    return this.urls.length - 1;
  }

  // Returns `{ image, focusX }` for `progress` in 0–1, or null before any
  // frame has loaded.
  frameAt(progress) {
    if (this.isEmpty) return null;
    const clamped = Math.min(1, Math.max(0, progress));
    const image = this.nearestLoaded(Math.round(clamped * this.lastIndex));
    return image ? { image, focusX: this.focusX } : null;
  }

  nearestLoaded(index) {
    for (let offset = 0; offset < this.images.length; offset++) {
      const before = this.images[index - offset];
      if (before) return before;
      const after = this.images[index + offset];
      if (after) return after;
    }
    return null;
  }

  isRequested(index) {
    return this.requested.has(index);
  }

  // Loads one frame once. A frame that fails is reported and not retried;
  // playback falls back to its neighbours.
  async loadFrame(index) {
    if (this.requested.has(index)) return;
    this.requested.add(index);
    try {
      this.images[index] = await loadImage(this.urls[index]);
    } catch (error) {
      console.error(`[${this.id}] frame ${index} failed to load: ${this.urls[index]}`, error);
    }
  }
}

async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
