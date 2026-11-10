import { useEffect, useRef } from 'react';

interface UseDialogFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

export function useDialogFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  initialFocusRef,
}: UseDialogFocusTrapOptions) {
  const containerRef = useRef<T>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Keep latest callbacks/refs in refs so useEffect doesn't need to re-run on re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!isOpen) return;

    // Save active element to restore focus when closing
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Focus initial element or first focusable (only if focus isn't already inside the container)
    const focusTimer = setTimeout(() => {
      // If user is already focused or typing inside the container, never steal focus!
      if (document.activeElement && container.contains(document.activeElement)) {
        return;
      }

      if (initialFocusRefRef.current?.current) {
        initialFocusRefRef.current.current.focus();
      } else {
        const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  return containerRef;
}
