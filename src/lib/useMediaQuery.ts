import { useEffect, useState } from 'react'

/**
 * SSR-safe `matchMedia` hook. Returns whether `query` currently matches and
 * updates on viewport changes. Used to gate expensive GPU backgrounds
 * (WebGL shaders, particle canvases) off small screens.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * True only on pointer-capable, desktop-width viewports — the bar an effect
 * must clear before we mount heavy per-frame GPU work. Pair with
 * `useReducedMotion()` so motion-sensitive users always get the static path.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
