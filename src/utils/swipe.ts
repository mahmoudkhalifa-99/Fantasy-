import type React from 'react';

/** سحب لليمين على عنصر (موبايل). بيرجّع handlers تتحط على العنصر مباشرة. */
export function swipeRightHandlers(onSwipe: () => void, threshold = 60) {
  let start: { x: number; y: number } | null = null;
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start;
      start = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = Math.abs(t.clientY - s.y);
      if (dx > threshold && dy < 45) onSwipe();
    },
  };
}
