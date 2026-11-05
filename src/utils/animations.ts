import type { AnimationSettings } from '../types';

export const DEFAULT_ANIMATIONS: AnimationSettings = {
  level: 'subtle', speed: 100, confetti: false, pinUnlock: true, transitions: true, buttons: true,
};

export function animationPreferences(value: unknown): AnimationSettings {
  const input = value && typeof value === 'object' ? value as Partial<AnimationSettings> : {};
  return {
    level: input.level === 'off' || input.level === 'full' ? input.level : 'subtle',
    speed: typeof input.speed === 'number' && Number.isFinite(input.speed) ? Math.max(50, Math.min(200, input.speed)) : 100,
    confetti: typeof input.confetti === 'boolean' ? input.confetti : DEFAULT_ANIMATIONS.confetti,
    pinUnlock: typeof input.pinUnlock === 'boolean' ? input.pinUnlock : DEFAULT_ANIMATIONS.pinUnlock,
    transitions: typeof input.transitions === 'boolean' ? input.transitions : DEFAULT_ANIMATIONS.transitions,
    buttons: typeof input.buttons === 'boolean' ? input.buttons : DEFAULT_ANIMATIONS.buttons,
  };
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
