import { useEffect, useState } from 'react'

const Q = '(max-width: 820px), (pointer: coarse) and (max-width: 1100px)'
/** true on phones and small tablets: character fullscreen + bottom chat drawer + floating control wheel. */
export function useIsMobile() {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(Q).matches)
  useEffect(() => {
    const mq = matchMedia(Q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}
