import { useState, useEffect } from 'react'
import { BEFORE_AFTER } from '../config/beforeAfterAssets'
import { BeforeAfterMosaic } from '../components/BeforeAfterMosaic'

export function BeforeAfterPage() {
  const [splitPct, setSplitPct] = useState(48)
  const [flash, setFlash] = useState(() => {
    if (typeof window === 'undefined') return true
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (!flash) return undefined
    const t = window.setTimeout(() => setFlash(false), 480)
    return () => window.clearTimeout(t)
  }, [flash])

  return (
    <main className="beforeAfter beforeAfter--album">
      {flash && (
        <div
          className="beforeAfter__flash"
          aria-hidden
          onAnimationEnd={() => setFlash(false)}
        />
      )}

      <div className="beforeAfter__intro">
        <div className="beforeAfter__top">
          <h1 className="beforeAfter__title">Lumiq в дії</h1>
          <p className="beforeAfter__lead">
            Обидва фото в одній горизонтальній смузі; рухайте повзунок вліво–вправо — зліва «до», справа «після».
          </p>
        </div>
      </div>

      <div className="beforeAfter__bleed">
        <div className="beforeAfter__track">
          <div className="beforeAfter__stage">
            <img
              className="beforeAfter__img beforeAfter__img--after"
              src={BEFORE_AFTER.after}
              alt=""
              draggable={false}
              decoding="async"
              fetchPriority="high"
              sizes="100vw"
            />
            <div
              className="beforeAfter__imgWrap beforeAfter__imgWrap--before"
              style={{ clipPath: `polygon(0 0, ${splitPct}% 0, ${splitPct}% 100%, 0 100%)` }}
            >
              <img
                className="beforeAfter__img beforeAfter__img--before"
                src={BEFORE_AFTER.before}
                alt="Фото «до»"
                draggable={false}
                decoding="async"
                fetchPriority="high"
                sizes="100vw"
              />
            </div>
          </div>
          <div className="beforeAfter__handle" style={{ left: `${splitPct}%` }} aria-hidden>
            <span className="beforeAfter__handleLine" />
          </div>
          <input
            className="beforeAfter__range"
            type="range"
            min={4}
            max={96}
            step={0.5}
            value={splitPct}
            aria-label="Межа між фото «до» та «після»"
            onChange={(e) => setSplitPct(Number(e.currentTarget.value))}
            onInput={(e) => setSplitPct(Number(e.currentTarget.value))}
          />
        </div>
      </div>

      <BeforeAfterMosaic />
    </main>
  )
}
