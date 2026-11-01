// Draws one frame on a 2D canvas, fitted around a horizontal focus point.
// A frame that fills the canvas is cover-fitted and centred. On a canvas
// taller than the frame (a phone held upright), the frame is fitted to the
// width and anchored to the bottom, and its backdrop is extended upward, so
// the subject sits lower and clear of the copy at the top. Redraws only when
// the frame or the canvas size changes.

const MAX_PIXEL_RATIO = 2;
// The largest share of the canvas height left to the extended backdrop; a
// taller canvas crops the frame's sides instead.
const MAX_BACKDROP_SHARE = 0.2;
// Height, in CSS pixels, of the blend from the backdrop into the frame.
const FEATHER = 72;

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    // One pixel that a frame's top edge is shrunk into to read its backdrop colour.
    this.sampler = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    this.sampler.canvas.width = 1;
    this.sampler.canvas.height = 1;
    this.last = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Reallocating the canvas clears it, so it only happens when the drawing
  // size actually changes (mobile toolbars fire resize events while scrolling).
  resize() {
    this.ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.round(this.canvas.clientWidth * this.ratio);
    const height = Math.round(this.canvas.clientHeight * this.ratio);
    if (width === this.canvas.width && height === this.canvas.height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.imageSmoothingQuality = 'high';
    this.last = null;
  }

  // The average colour of the frame's top edge.
  backdropColour(image) {
    this.sampler.drawImage(image, 0, 0, image.naturalWidth, 8, 0, 0, 1, 1);
    const [red, green, blue] = this.sampler.getImageData(0, 0, 1, 1).data;
    return { opaque: `rgb(${red} ${green} ${blue})`, clear: `rgb(${red} ${green} ${blue} / 0)` };
  }

  // `frame` is `{ image, focusX }` or null while nothing has loaded.
  draw(frame) {
    if (!frame || frame.image === this.last) return;
    this.last = frame.image;

    const { image, focusX } = frame;
    const { width, height } = this.canvas;
    const scale = Math.max(
      width / image.naturalWidth,
      (height * (1 - MAX_BACKDROP_SHARE)) / image.naturalHeight,
    );
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (width - drawWidth) * focusX;

    if (drawHeight >= height) {
      this.context.drawImage(image, x, (height - drawHeight) / 2, drawWidth, drawHeight);
      return;
    }

    const top = height - drawHeight;
    const feather = Math.min(FEATHER * this.ratio, drawHeight);
    const backdrop = this.backdropColour(image);
    this.context.fillStyle = backdrop.opaque;
    this.context.fillRect(0, 0, width, top);
    this.context.drawImage(image, x, top, drawWidth, drawHeight);
    const blend = this.context.createLinearGradient(0, top, 0, top + feather);
    blend.addColorStop(0, backdrop.opaque);
    blend.addColorStop(1, backdrop.clear);
    this.context.fillStyle = blend;
    this.context.fillRect(0, top, width, feather);
  }
}
