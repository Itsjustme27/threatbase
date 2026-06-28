import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Full-bleed animated aurora shader, rendered as a background layer.
 * Fills its positioned parent (place inside a `relative` container) and sits
 * behind content with pointer-events disabled. No mouse interaction.
 */
export default function AnimatedShaderBackground({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Antialias off: this is a soft, blurred, opacity-40 ambient wash sitting
    // behind dark gradients — MSAA is invisible here and just burns GPU.
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    if (!renderer.getContext()) return // WebGL unavailable — bail gracefully

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Fragment-shader cost scales with pixel count. The shader is a full-screen
    // per-pixel fbm loop, so rendering the drawing buffer at 60% of CSS size and
    // letting the GPU upscale cuts fragment work to ~36% with no visible change
    // on a blurred background.
    const RES_SCALE = 0.6
    const sizeOf = () => ({
      w: container.clientWidth || window.innerWidth,
      h: container.clientHeight || window.innerHeight,
    })

    const initial = sizeOf()
    renderer.setPixelRatio(1)
    // updateStyle=false: keep the canvas stretched to 100% via CSS while the
    // drawing buffer stays at the reduced internal resolution.
    renderer.setSize(initial.w * RES_SCALE, initial.h * RES_SCALE, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    container.appendChild(renderer.domElement)

    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        iTime: { value: 0 },
        // iResolution must match the drawing-buffer size (gl_FragCoord is in
        // buffer pixels), so use the reduced internal resolution.
        iResolution: { value: new THREE.Vector2(initial.w * RES_SCALE, initial.h * RES_SCALE) },
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;

        #define NUM_OCTAVES 2

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);

          float res = mix(
            mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0;
          float a = 0.3;
          vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.4;
          }
          return v;
        }

        void main() {
          vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
          vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
          vec2 v;
          vec4 o = vec4(0.0);

          float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

          // Reduced loop iterations from 35.0 to 12.0 for drastically better performance
          for (float i = 0.0; i < 12.0; i++) {
            v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
            float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 12.0));
            vec4 auroraColors = vec4(
              0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4),
              0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5),
              0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3),
              1.0
            );
            // Increased base contribution multiplier to compensate for fewer iterations
            vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i / 12.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor * 2.5;
          }

          o = tanh(pow(o / 100.0, vec4(1.6)));
          gl_FragColor = o * 1.5;
        }
      `,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Cap to ~30fps. rAF fires at the display refresh (60/120/144Hz), so an
    // uncapped loop renders this expensive shader far more often than a soft
    // ambient wash needs. We accumulate real elapsed time into iTime so the
    // animation runs at the same visual speed regardless of the cap.
    const FRAME_MS = 1000 / 30
    let frameId = 0
    let lastTime = 0
    let running = false
    let isOnScreen = true

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      if (!lastTime) lastTime = now
      const elapsed = now - lastTime
      if (elapsed < FRAME_MS) return
      lastTime = now - (elapsed % FRAME_MS)
      material.uniforms.iTime.value += elapsed / 1000
      renderer.render(scene, camera)
    }

    const start = () => {
      if (running) return
      running = true
      lastTime = 0
      frameId = requestAnimationFrame(animate)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(frameId)
    }

    // Pause when the tab is backgrounded — no point rendering an unseen canvas.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
      else if (isOnScreen) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Pause when scrolled out of view (the credits list below is long).
    const observer = new IntersectionObserver(
      ([entry]) => {
        isOnScreen = entry.isIntersecting
        if (isOnScreen && document.visibilityState === 'visible') start()
        else stop()
      },
      { threshold: 0 },
    )
    observer.observe(container)

    start()

    const handleResize = () => {
      const { w, h } = sizeOf()
      renderer.setSize(w * RES_SCALE, h * RES_SCALE, false)
      material.uniforms.iResolution.value.set(w * RES_SCALE, h * RES_SCALE)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', handleResize)
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    />
  )
}
