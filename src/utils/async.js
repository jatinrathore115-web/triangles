// Promise wrappers so multi-step animation sequences read top to bottom.

export function tween(scene, config) {
  return new Promise((resolve) => {
    const onComplete = config.onComplete;
    const onStop = config.onStop;
    scene.tweens.add({
      ...config,
      onComplete: (...args) => {
        onComplete?.(...args);
        resolve();
      },
      // a stopped/killed tween must never leave a sequence waiting forever
      onStop: (...args) => {
        onStop?.(...args);
        resolve();
      },
    });
  });
}

export function wait(scene, ms) {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

/** Like tweens.killTweensOf, but stops (fires onStop) so awaiting promises resolve. */
export function stopTweensOf(scene, targets) {
  scene.tweens.getTweensOf(targets).forEach((t) => t.stop());
}
