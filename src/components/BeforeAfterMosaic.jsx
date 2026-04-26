import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BEFORE_AFTER_GALLERY } from '../data/beforeAfterGallery'

const n = BEFORE_AFTER_GALLERY.length

export function BeforeAfterMosaic() {
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    if (!zoom) return
    const onKey = (e) => {
      if (e.key === 'Escape') setZoom(null)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [zoom])

  const overlay =
    zoom &&
    createPortal(
      <div
        className="baMosaic-zoom"
        role="dialog"
        aria-modal="true"
        aria-label="Фото в повний розмір"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setZoom(null)
        }}
      >
        <button type="button" className="baMosaic-zoom__close" onClick={() => setZoom(null)} aria-label="Закрити">
          ×
        </button>
        <img
          className="baMosaic-zoom__img"
          src={zoom.src}
          alt={zoom.alt}
          sizes="100vw"
          decoding="async"
          fetchPriority="high"
        />
      </div>,
      document.body
    )

  return (
    <>
      <section className="baAlbum" aria-labelledby="baAlbum-title">
        <div className="baAlbum__intro">
          <p className="baAlbum__kicker">( {n}&nbsp;PHOTOS )</p>
          <h2 id="baAlbum-title" className="baAlbum__title">
            Ще знімків
          </h2>
          <p className="baAlbum__lead">Гортай вниз. Натисни кадр, щоб відкрити ще крупніше.</p>
        </div>

        <div className="baAlbum__bleed">
          {BEFORE_AFTER_GALLERY.map((item, i) => (
            <figure key={item.src} className="baAlbum__frame">
              <button
                type="button"
                className="baAlbum__open"
                onClick={() => setZoom(item)}
                aria-label={`Відкрити великим: ${item.alt}`}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  sizes="(max-width: 1200px) min(1125px, calc(100vw - 2rem)), 1125px"
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                />
              </button>
            </figure>
          ))}
        </div>
      </section>
      {overlay}
    </>
  )
}
