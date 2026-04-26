import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NovaPoshtaDeliverySection } from '../components/NovaPoshtaDeliverySection'
import '../checkout.css'

const PRODUCT_NAME = 'Дифузор Lumiq для накамерного спалаху'
const PRODUCT_QTY = 1
const PRODUCT_PRICE = 0

const PAYMENT_OPTIONS = [
  { id: 'card', label: 'Карткою / Apple Pay / Google Pay' },
  { id: 'invoice', label: 'Оплата за реквізитами' },
  { id: 'cod', label: 'Післяплата Нова пошта' },
]

function Field({ label, required, children }) {
  return (
    <label className="checkout-field">
      <span className="checkout-field__label">
        {label}
        {required ? <span className="checkout-field__req"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

const NP_API_KEY = String(import.meta.env.VITE_NOVA_POSHTA_API_KEY ?? '').trim()

export function OrderPage() {
  const [payment, setPayment] = useState('card')
  const [deliveryMethod, setDeliveryMethod] = useState('np_branch')

  function onSubmit(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const branchLabel = fd.get('branchDescription') || fd.get('branch')
    const branchNpRef = fd.get('branchRef')
    const cityNpRef = fd.get('cityRef')
    const lines = [
      `Замовлення Lumiq`,
      `---`,
      `Email: ${fd.get('email')}`,
      `Ім'я: ${fd.get('firstName')} ${fd.get('lastName')}`,
      `Телефон: ${fd.get('phone')}`,
      `Доставка: ${fd.get('deliveryMethod')}`,
      `Місто: ${fd.get('city')}`,
      cityNpRef ? `Ref міста НП: ${cityNpRef}` : null,
      `Відділення НП: ${branchLabel || '—'}`,
      branchNpRef ? `Ref відділення НП: ${branchNpRef}` : null,
      `Instagram: ${fd.get('instagram') || '—'}`,
      `Примітка: ${fd.get('notes') || '—'}`,
      `Оплата: ${PAYMENT_OPTIONS.find((p) => p.id === payment)?.label}`,
    ]
      .filter((line) => line != null)
      .join('\n')

    const subject = encodeURIComponent('Замовлення Lumiq')
    const body = encodeURIComponent(lines)
    window.location.href = `mailto:hello@example.com?subject=${subject}&body=${body}`
  }

  return (
    <main className="checkout">
      <div className="checkout__top">
        <Link className="checkout__breadcrumb" to="/">
          ← Повернутися до магазину
        </Link>
        <h1 className="checkout__page-title">Оплата та доставка</h1>
      </div>

      <form className="checkout__grid" onSubmit={onSubmit} noValidate>
        <div className="checkout__fields">
          <section className="checkout__block">
            <h2 className="checkout__section-title">Оплата та доставка</h2>

            <Field label="Адреса електронної пошти" required>
              <input className="checkout__input" name="email" type="email" required autoComplete="email" />
            </Field>

            <div className="checkout__row2">
              <Field label="Ім’я" required>
                <input className="checkout__input" name="firstName" type="text" required autoComplete="given-name" />
              </Field>
              <Field label="Прізвище" required>
                <input className="checkout__input" name="lastName" type="text" required autoComplete="family-name" />
              </Field>
            </div>

            <Field label="Країна / регіон" required>
              <select className="checkout__select" name="country" defaultValue="UA" required>
                <option value="UA">Україна</option>
              </select>
            </Field>

            <Field label="Телефон" required>
              <input
                className="checkout__input"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                placeholder="+380 …"
              />
            </Field>
          </section>

          <section className="checkout__block">
            <h2 className="checkout__section-title">Адреса доставки</h2>

            <Field label="Спосіб доставки" required>
              <select
                className="checkout__select"
                name="deliveryMethod"
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
                required
              >
                <option value="np_branch">У відділення Нової пошти</option>
                <option value="np_courier">Кур’єром Нової пошти</option>
              </select>
            </Field>

            <NovaPoshtaDeliverySection apiKey={NP_API_KEY} deliveryMethod={deliveryMethod} />

            <Field label="Ваш Instagram">
              <input className="checkout__input" name="instagram" type="text" placeholder="Наприклад, @username" />
            </Field>
          </section>

          <section className="checkout__block">
            <h2 className="checkout__section-title">Додаткова інформація</h2>
            <Field label="Примітки до замовлення (необов’язково)">
              <textarea className="checkout__textarea" name="notes" rows={4} placeholder="Особливі побажання…" />
            </Field>
          </section>
        </div>

        <aside className="checkout__aside">
          <div className="checkout__summary">
            <h2 className="checkout__section-title checkout__section-title--aside">Ваше замовлення</h2>

            <div className="checkout__line">
              <span>
                {PRODUCT_NAME} × {PRODUCT_QTY}
              </span>
              <span className="checkout__muted">{PRODUCT_PRICE > 0 ? `${PRODUCT_PRICE} ₴` : '—'}</span>
            </div>

            <div className="checkout__totals">
              <div className="checkout__line checkout__line--sub">
                <span>Проміжний підсумок</span>
                <span>{PRODUCT_PRICE > 0 ? `${PRODUCT_PRICE} ₴` : '—'}</span>
              </div>
              <div className="checkout__line checkout__line--sub">
                <span>Доставка</span>
                <span>Нова пошта</span>
              </div>
              <div className="checkout__line checkout__line--total">
                <span>Разом</span>
                <span>{PRODUCT_PRICE > 0 ? `${PRODUCT_PRICE} ₴` : '—'}</span>
              </div>
            </div>
          </div>

          <div className="checkout__payments">
            <p className="checkout__payments-label">Спосіб оплати</p>
            <ul className="checkout__payment-list">
              {PAYMENT_OPTIONS.map((opt) => (
                <li key={opt.id}>
                  <label
                    className={`checkout__payment${payment === opt.id ? ' checkout__payment--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={opt.id}
                      checked={payment === opt.id}
                      onChange={() => setPayment(opt.id)}
                      className="checkout__payment-input"
                    />
                    <span className="checkout__payment-text">{opt.label}</span>
                    {payment === opt.id ? <span className="checkout__payment-check" aria-hidden /> : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <button type="submit" className="checkout__submit checkout__submit--wide">
            Підтвердити замовлення
          </button>
        </aside>
      </form>
    </main>
  )
}
