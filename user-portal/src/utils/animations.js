import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';

/** 弹窗入场+退场动画：backdrop 淡入 + 卡片 scale+fade */
export function usePopupAnimation(open) {
  const backdropRef = useRef(null);
  const cardRef = useRef(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    const ctx = gsap.context(() => {
      if (backdropRef.current) {
        gsap.fromTo(backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.15, ease: 'power2.out' }
        );
      }
      if (cardRef.current) {
        gsap.fromTo(cardRef.current,
          { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: 0.25, ease: 'power3.out' }
        );
      }
    });
    return () => ctx.revert();
  }, [open]);

  const animateOut = useCallback((callback) => {
    if (closingRef.current) return;
    closingRef.current = true;
    const tl = gsap.timeline({ onComplete: () => {
      closingRef.current = false;
      callback?.();
    }});
    if (cardRef.current) {
      tl.to(cardRef.current,
        { opacity: 0, scale: 0.92, duration: 0.2, ease: 'power3.in' },
        0
      );
    }
    if (backdropRef.current) {
      tl.to(backdropRef.current,
        { opacity: 0, duration: 0.15, ease: 'power2.in' },
        0
      );
    }
  }, []);

  return { backdropRef, cardRef, animateOut };
}
