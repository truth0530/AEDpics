// Custom hook for gesture-based interactions
import { useEffect, useRef, useState, useCallback } from 'react';

export interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinchZoom?: (scale: number) => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
}

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export function useGestures(
  elementRef: React.RefObject<HTMLElement>,
  handlers: GestureHandlers
) {
  const [isGestureActive, setIsGestureActive] = useState(false);
  const touchStartRef = useRef<TouchPoint[]>([]);
  const touchEndRef = useRef<TouchPoint | null>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialPinchDistanceRef = useRef<number>(0);

  // Calculate distance between two touch points
  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    setIsGestureActive(true);
    
    // Clear any existing long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Record touch points
    touchStartRef.current = Array.from(e.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }));

    // Handle pinch zoom start
    if (e.touches.length === 2) {
      initialPinchDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
    }

    // Start long press timer for single touch
    if (e.touches.length === 1 && handlers.onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        handlers.onLongPress!();
        setIsGestureActive(false);
      }, 500);
    }
  }, [handlers, getDistance]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Cancel long press if moving
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Handle pinch zoom
    if (e.touches.length === 2 && handlers.onPinchZoom) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialPinchDistanceRef.current;
      handlers.onPinchZoom(scale);
    }
  }, [handlers, getDistance]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now()
      };

      // Check for swipe gestures (single touch)
      if (touchStartRef.current.length === 1) {
        const start = touchStartRef.current[0];
        const end = touchEndRef.current;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = end.timestamp - start.timestamp;
        const velocity = distance / duration;

        // Minimum swipe distance and velocity thresholds
        const minDistance = 50;
        const minVelocity = 0.3;

        if (distance > minDistance && velocity > minVelocity) {
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          
          // Determine swipe direction
          if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal swipe
            if (dx > 0 && handlers.onSwipeRight) {
              handlers.onSwipeRight();
            } else if (dx < 0 && handlers.onSwipeLeft) {
              handlers.onSwipeLeft();
            }
          } else {
            // Vertical swipe
            if (dy > 0 && handlers.onSwipeDown) {
              handlers.onSwipeDown();
            } else if (dy < 0 && handlers.onSwipeUp) {
              handlers.onSwipeUp();
            }
          }
        }

        // Check for double tap
        if (distance < 10 && duration < 200) {
          const now = Date.now();
          if (now - lastTapRef.current < 300 && handlers.onDoubleTap) {
            handlers.onDoubleTap();
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
          }
        }
      }
    }

    setIsGestureActive(false);
  }, [handlers]);

  // Attach event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Prevent default touch behaviors
    const preventDefault = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    element.addEventListener('touchstart', preventDefault, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
      element.removeEventListener('touchstart', preventDefault);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isGestureActive };
}

// Swipe carousel hook
export function useSwipeCarousel<T>(
  items: T[],
  options?: {
    loop?: boolean;
    onIndexChange?: (index: number) => void;
  }
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => {
      const next = options?.loop 
        ? (prev + 1) % items.length
        : Math.min(prev + 1, items.length - 1);
      options?.onIndexChange?.(next);
      return next;
    });
  }, [items.length, options]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => {
      const next = options?.loop
        ? (prev - 1 + items.length) % items.length
        : Math.max(prev - 1, 0);
      options?.onIndexChange?.(next);
      return next;
    });
  }, [items.length, options]);

  useGestures(containerRef as React.RefObject<HTMLElement>, {
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrevious,
  });

  return {
    containerRef,
    currentIndex,
    currentItem: items[currentIndex],
    goToNext,
    goToPrevious,
    goToIndex: (index: number) => {
      setCurrentIndex(index);
      options?.onIndexChange?.(index);
    }
  };
}