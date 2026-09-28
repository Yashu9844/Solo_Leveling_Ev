import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { TransitionEdge } from '../kit';
import { edgeFor } from './edges';

/**
 * The edge crossed to reach the current route.
 *
 * Computed during render rather than in an effect, so the entering
 * screen already knows its direction on its first frame — an effect
 * would land a frame late and the first transition of every navigation
 * would play the wrong way.
 */
export function useTransitionEdge(): TransitionEdge {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);
  const edge = edgeFor(previous.current, pathname);

  useEffect(() => {
    previous.current = pathname;
  }, [pathname]);

  return edge;
}
