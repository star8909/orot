// Loads the film's frames coarse to fine so that a fast scroll on a fresh
// page already plays motion: every 16th frame of a clip first, then every
// 8th, 4th, 2nd and finally the rest, filling the gaps in between. The clip
// on screen and the one after it are refined ahead of the others.

const STRIDES = [16, 8, 4, 2, 1];

// Levels the clips near the viewer are ahead of the rest.
const FAR_PENALTY = 2;

// The coarsest pass a frame belongs to; a clip's first and last frames are
// always in the first pass so chapter boundaries are never blank.
function levelOf(index, lastIndex) {
  if (index === 0 || index === lastIndex) return 0;
  return STRIDES.findIndex((stride) => index % stride === 0);
}

export class FrameLoader {
  constructor(tracks, concurrency = 6) {
    this.tracks = tracks;
    this.concurrency = concurrency;
    this.focusIndex = 0;
    this.workers = 0;
    this.paused = true;
  }

  // Sets the clip on screen; the next frame picked reflects it.
  focus(trackIndex) {
    this.focusIndex = trackIndex;
  }

  start() {
    this.paused = false;
    while (this.workers < this.concurrency) {
      this.workers += 1;
      this.work().finally(() => {
        this.workers -= 1;
      });
    }
  }

  // In-flight frames finish; no new ones are requested until start().
  pause() {
    this.paused = true;
  }

  async work() {
    for (let next = this.next(); next && !this.paused; next = this.next()) {
      await next.track.loadFrame(next.index);
    }
  }

  // The unrequested frame with the lowest cost: its pass, pushed back for
  // clips away from the viewer, then clips ahead before clips behind, then
  // frame order.
  next() {
    let best = null;
    let bestCost = Infinity;
    this.tracks.forEach((track, trackIndex) => {
      const offset = trackIndex - this.focusIndex;
      const near = offset === 0 || offset === 1;
      const distance = offset >= 0 ? offset * 2 : -offset * 2 + 1;
      for (let index = 0; index <= track.lastIndex; index++) {
        if (track.isRequested(index)) continue;
        const level = levelOf(index, track.lastIndex) + (near ? 0 : FAR_PENALTY);
        const cost = (level * this.tracks.length * 2 + distance) * track.urls.length + index;
        if (cost < bestCost) {
          best = { track, index };
          bestCost = cost;
        }
      }
    });
    return best;
  }
}
