import React, { useLayoutEffect, useRef } from 'react';
interface Props extends React.HTMLAttributes<HTMLDivElement> {
  onClose: () => void;
  label: string;
}
export function Dialog({ onClose, label, children, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = ref.current!;
    const siblings = [...(root.parentElement?.children || [])]
      .filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node !== root,
      )
      .map((node) => ({ node, inert: node.inert }));
    for (const { node } of siblings) node.inert = true;
    const focusable = () =>
      [
        ...root.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex="0"]',
        ),
      ].filter(
        (e) => !e.hasAttribute('disabled') && e.getClientRects().length > 0,
      );
    (
      root.querySelector<HTMLElement>('[data-autofocus]') ||
      focusable()[0] ||
      root
    ).focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) {
          e.preventDefault();
          root.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first ||
            !root.contains(document.activeElement))
        ) {
          e.preventDefault();
          last!.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !root.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const contain = (e: FocusEvent) => {
      if (!root.contains(e.target as Node)) (focusable()[0] || root).focus();
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', contain);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', contain);
      document.body.style.overflow = bodyOverflow;
      for (const { node, inert } of siblings) node.inert = inert;
      previous?.focus();
    };
  }, []);
  return (
    <div
      {...props}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
