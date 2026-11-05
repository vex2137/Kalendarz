import { useCallback, useLayoutEffect, useRef } from 'react';
import type { AnimationSettings } from '../types';
import { reducedMotion } from '../utils/animations';

/** The live dialog remains focus-trapped until exit; never retain a copy of private UI. */
export function useAnimatedClose(owner: string, finish: () => void, motion: AnimationSettings, selector = '[role="dialog"]') {
  const epoch = useRef(0);
  const pending = useRef<Animation | null>(null);
  const complete = useRef(finish);
  complete.current = finish;
  useLayoutEffect(() => {
    epoch.current++;
    return () => { epoch.current++; pending.current?.cancel(); pending.current = null; };
  }, [owner]);
  return useCallback(() => {
    if (pending.current) return;
    const dialog = document.querySelector<HTMLElement>(selector);
    if (!dialog || !dialog.animate || motion.level === 'off' || !motion.transitions || reducedMotion()) {
      complete.current(); return;
    }
    const token = epoch.current;
    const animation = dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 160 * 100 / motion.speed, easing: 'ease-out', fill: 'forwards',
    });
    pending.current = animation;
    const done = () => {
      if (token !== epoch.current) return;
      pending.current = null;
      complete.current();
    };
    void animation.finished.then(done, done);
  }, [motion.level, motion.transitions, motion.speed, selector]);
}
