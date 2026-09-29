import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useBoot } from '../boot'
import { log } from '../log'

/** Pre-compiles every shader (incl. the nano-patched suit) so the first transformation doesn't hitch, and handles WebGL context loss. */
export default function Boot() {
  const { gl, scene, camera } = useThree()
  const mark = useBoot((s) => s.mark)
  const setGfxError = useBoot((s) => s.setGfxError)

  useEffect(() => {
    let cancelled = false
    const el = gl.domElement
    const lost = (e: Event) => { e.preventDefault(); log.warn('webgl.contextlost'); setGfxError('Graphics context lost — restoring…') }
    const restored = () => { log.info('webgl.contextrestored'); setGfxError('') }
    el.addEventListener('webglcontextlost', lost); el.addEventListener('webglcontextrestored', restored)

    const t = setTimeout(async () => {
      // temporarily show everything so the compiler sees all program variants
      const hidden: { o: { visible: boolean }; v: boolean }[] = []
      scene.traverse((o) => { if (!o.visible) { hidden.push({ o, v: false }); o.visible = true } })
      try { await (gl as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<void> }).compileAsync?.(scene, camera) ?? gl.compile(scene, camera) }
      catch (e) { log.warn('shader.precompile.failed', { message: String((e as Error).message).slice(0, 120) }) }
      for (const h of hidden) h.o.visible = h.v
      if (!cancelled) mark('model')
    }, 60)
    return () => { cancelled = true; clearTimeout(t); el.removeEventListener('webglcontextlost', lost); el.removeEventListener('webglcontextrestored', restored) }
  }, [gl, scene, camera, mark, setGfxError])
  return null
}
