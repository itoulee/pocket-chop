/**
 * Circular rotary knob — hardware pot/encoder metaphor.
 * Value 0..1; drag vertically or angularly; mouse wheel.
 */

export interface RotaryKnobOpts {
  value?: number
  label?: string
  size?: number
  onChange: (v: number) => void
}

export function createRotaryKnob(opts: RotaryKnobOpts): HTMLElement {
  const value = { v: clamp(opts.value ?? 0.5) }
  const size = opts.size ?? 72

  const wrap = document.createElement('div')
  wrap.className = 'rotary'
  wrap.style.setProperty('--knob-size', `${size}px`)
  wrap.innerHTML = `
    <div class="rotary-body" role="slider" aria-valuemin="0" aria-valuemax="100" tabindex="0">
      <div class="rotary-grip"></div>
      <div class="rotary-pointer"></div>
      <div class="rotary-center"></div>
    </div>
    ${opts.label ? `<span class="rotary-label">${opts.label}</span>` : ''}
  `

  const body = wrap.querySelector('.rotary-body') as HTMLElement
  const pointer = wrap.querySelector('.rotary-pointer') as HTMLElement

  const apply = () => {
    // Map 0..1 → -135deg .. +135deg
    const deg = -135 + value.v * 270
    pointer.style.transform = `rotate(${deg}deg)`
    body.setAttribute('aria-valuenow', String(Math.round(value.v * 100)))
  }
  apply()

  const setValue = (v: number, emit = true) => {
    value.v = clamp(v)
    apply()
    if (emit) opts.onChange(value.v)
  }

  wrap.addEventListener('wheel', (e) => {
    e.preventDefault()
    setValue(value.v + (e.deltaY > 0 ? -0.02 : 0.02))
  }, { passive: false })

  let dragging = false
  let lastY = 0
  let lastAngle: number | null = null

  const angleFromEvent = (e: PointerEvent) => {
    const r = body.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    return Math.atan2(e.clientY - cy, e.clientX - cx)
  }

  body.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    body.setPointerCapture(e.pointerId)
    dragging = true
    lastY = e.clientY
    lastAngle = angleFromEvent(e)
    wrap.classList.add('dragging')
  })

  body.addEventListener('pointermove', (e) => {
    if (!dragging) return
    // Prefer vertical drag for fine control; also blend angular
    const dy = lastY - e.clientY
    lastY = e.clientY
    let next = value.v + dy * 0.005

    const ang = angleFromEvent(e)
    if (lastAngle != null) {
      let d = ang - lastAngle
      if (d > Math.PI) d -= Math.PI * 2
      if (d < -Math.PI) d += Math.PI * 2
      // clockwise increases
      next = value.v + d / (Math.PI * 1.5)
    }
    lastAngle = ang
    setValue(next)
  })

  const end = () => {
    dragging = false
    lastAngle = null
    wrap.classList.remove('dragging')
  }
  body.addEventListener('pointerup', end)
  body.addEventListener('pointercancel', end)

  body.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      setValue(value.v + 0.02)
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setValue(value.v - 0.02)
    }
  })

  ;(wrap as unknown as { setRotaryValue: (v: number) => void }).setRotaryValue = (v: number) =>
    setValue(v, false)

  return wrap
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v))
}
