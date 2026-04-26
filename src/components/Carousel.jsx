import { useCallback, useEffect, useState } from 'react'

const AUTO_MS = 5500

export function Carousel({ slides }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const n = slides.length

  const go = useCallback(
    (delta) => {
      setIndex((i) => (i + delta + n) % n)
    },
    [n],
  )

  useEffect(() => {
    if (paused || n < 2 || lightboxOpen) return
    const t = setInterval(() => go(1), AUTO_MS)
    return () => clearInterval(t)
  }, [go, paused, n, lightboxOpen])

  useEffect(() => {
    if (!lightboxOpen) return
    function onKey(e) {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxOpen])

  const slide = slides[index]

  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    }
  }

  return (
    <div
      className="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Фото дифузорів"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="carousel__viewport">
        <button
          type="button"
          className="carousel__open"
          onClick={() => setLightboxOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={lightboxOpen}
          aria-label={`Відкрити фото в повний розмір: ${slide.title}`}
        >
          <img
            className="carousel__img"
            src={slide.src}
            alt={slide.alt}
            sizes="(max-width: 1126px) 90vw, 750px"
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            draggable={false}
          />
        </button>
        <div className="carousel__caption">
          <span className="carousel__title">{slide.title}</span>
        </div>
      </div>

      {lightboxOpen ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={slide.title}
        >
          <button
            type="button"
            className="lightbox__backdrop"
            aria-label="Закрити перегляд"
            onClick={() => setLightboxOpen(false)}
          />
          <div className="lightbox__panel">
            <button
              type="button"
              className="lightbox__close"
              aria-label="Закрити"
              onClick={() => setLightboxOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <img
              className="lightbox__img"
              src={slide.src}
              alt={slide.alt}
              sizes="100vw"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </div>
      ) : null}

      <div className="carousel__controls">
        <button type="button" className="carousel__arrow" onClick={() => go(-1)} aria-label="Попереднє фото">
          <svg className="carousel__arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M14 6l-6 6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="carousel__dots" role="tablist" aria-label="Слайди">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Слайд ${i + 1}`}
              className={`carousel__dot${i === index ? ' carousel__dot--active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <button type="button" className="carousel__arrow" onClick={() => go(1)} aria-label="Наступне фото">
          <svg className="carousel__arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M10 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
