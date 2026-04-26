import { Link } from 'react-router-dom'
import { Carousel } from '../components/Carousel'
import { SLIDES } from '../data/slides'

export function HomePage() {
  return (
    <main id="home" className="main">
      <section className="hero">
        <p className="hero__eyebrow">Lumiq — аксесуари для накамерного спалаху</p>
        <h1 className="hero__title">Дифузори для спалахів</h1>
        <p className="hero__lead">
          М’які тіні, природні портрети та передбачуване світло — у каруселі реальні фото продукції Lumiq.
        </p>
      </section>

      <Carousel slides={SLIDES} />

      <section id="kupiti" className="buy">
        <h2 className="buy__heading">Готові замовити?</h2>
        <p className="buy__text">Заповніть форму доставки Новою поштою — після відправки відкриється ваш поштовий клієнт із готовим листом.</p>
        <Link className="buy__btn" to="/order">
          Купити
        </Link>
      </section>
    </main>
  )
}
