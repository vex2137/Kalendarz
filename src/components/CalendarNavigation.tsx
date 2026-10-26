import React, { useEffect, useRef } from 'react';

const editing = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="spinbutton"], [role="combobox"], [data-no-swipe]',
));

export function CalendarNavigation({ enabled, dateKey, onNavigate, children, allowHorizontalScroll = false }: {
  enabled: boolean; dateKey: string; onNavigate: (direction: number) => void; children: React.ReactNode; allowHorizontalScroll?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; vertical: boolean } | null>(null);
  const suppressClick = useRef(0);
  const previous = useRef(dateKey);
  const animation = useRef<Animation | null>(null);
  const go = (delta: number) => onNavigate(delta);
  const navigateRef = useRef(go);
  navigateRef.current = go;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!enabled || event.defaultPrevented || event.isComposing || event.repeat ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editing(event.target) ||
        document.querySelector('[role="dialog"]') || window.getSelection()?.isCollapsed === false) return;
      const delta = ({ ArrowLeft: -1, ArrowRight: 1, a: -1, d: 1 })[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (delta) { event.preventDefault(); navigateRef.current(delta); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [enabled]);
  useEffect(() => {
    if (previous.current === dateKey) return;
    const forward = dateKey > previous.current;
    previous.current = dateKey;
    animation.current?.cancel();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animation.current = root.current?.animate([
      { transform: `translateX(${forward ? 12 : -12}px)`, opacity: 0.7 },
      { transform: 'translateX(0)', opacity: 1 },
    ], { duration: 160, easing: 'ease-out' }) || null;
  }, [dateKey]);
  useEffect(() => () => animation.current?.cancel(), []);
  return <div ref={root} data-testid="calendar-navigation" data-date-key={dateKey} className="calendar-gesture-area flex flex-1 min-h-0 min-w-0 overflow-hidden"
    style={{ touchAction: allowHorizontalScroll ? 'pan-x pan-y pinch-zoom' : 'pan-y pinch-zoom' }}
    onPointerDownCapture={event => {
      if (!enabled || event.pointerType !== 'touch' || !event.isPrimary || editing(event.target)) { gesture.current = null; return; }
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, vertical: false };
    }}
    onPointerMoveCapture={event => {
      const start = gesture.current;
      if (start?.id === event.pointerId && Math.abs(event.clientY - start.y) > 12 &&
        Math.abs(event.clientY - start.y) > Math.abs(event.clientX - start.x)) start.vertical = true;
    }}
    onPointerCancelCapture={() => { gesture.current = null; }}
    onPointerUpCapture={event => {
      const start = gesture.current;
      gesture.current = null;
      if (!enabled || !start || start.id !== event.pointerId || start.vertical) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      const threshold = Math.max(48, Math.min(96, (root.current?.clientWidth || 320) * 0.15));
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      suppressClick.current = performance.now() + 400;
      event.preventDefault();
      navigateRef.current(dx < 0 ? 1 : -1);
    }}
    onClickCapture={event => {
      if (event.detail !== 0 && performance.now() < suppressClick.current) { event.preventDefault(); event.stopPropagation(); }
    }}>
    {children}
  </div>;
}
