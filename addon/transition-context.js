import { rAF } from './concurrency-helpers';
import { Scheduler } from './micro-routines';


export default class TransitionContext {
  constructor(duration, insertedSprites, keptSprites, removedSprites, farMatches, removalMotions) {
    this.duration = duration;
    this._scheduler = new Scheduler(onError);
    this.insertedSprites = insertedSprites;
    this.keptSprites = keptSprites;
    this.removedSprites = removedSprites;
    this._farMatches = farMatches;
    this._removalMotions = removalMotions;
  }
  matchFor(sprite) {
    return this._farMatches.get(sprite);
  }
  get insertedSprite() {
    return this.insertedSprites[0];
  }
  get removedSprite() {
    return this.removedSprites[0];
  }
  animate(MotionClass, sprite, opts) {
    if (!opts) {
      opts = { duration: this.duration }
    } else {
      if (opts.duration == null) {
        opts = Object.assign({}, opts);
        opts.duration = this.duration;
      }
    }
    let motion = new MotionClass(sprite, opts);
    this._scheduler.spawn(this._motionGenerator(motion));
    return motion._promise;
  }
  _motionGenerator(motion) {
    if (this.removedSprites.indexOf(motion.sprite) !== -1) {
      return this._removalMotionGenerator(motion);
    }
    if (this.insertedSprites.indexOf(motion.sprite) !== -1) {
      motion.sprite.reveal();
    }
    return motion._run();
  }
  *_removalMotionGenerator(motion) {
    let motionCounts = this._removalMotions;
    let count = motionCounts.get(motion.sprite) || 0;
    if (count === 0) {
      motion.sprite.append();
      motion.sprite.lock();
    }
    count++;
    motionCounts.set(motion.sprite, count);
    try {
      yield * motion._run();
    } finally {
      rAF().then(() => {
        let count = motionCounts.get(motion.sprite);
        if (count > 1) {
          motionCounts.set(motion.sprite, --count);
        } else {
          motion.sprite.remove();
          motionCounts.delete(motion.sprite)
        }
      });
    }
  }
  *_runToCompletion(transition) {
    this._scheduler.spawn(transition.call(this));
    yield * this._scheduler.run();
  }
}

function onError(reason) {
  if (reason.name !== 'TaskCancelation') {
    setTimeout(function() {
      throw reason;
    }, 0);
  }
}
