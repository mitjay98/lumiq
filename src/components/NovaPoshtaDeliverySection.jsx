import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { fetchWarehousesForPick, peekWarehousesForPick, searchCities } from '../lib/novaPoshta'

const DEBOUNCE_MS = 350

function useDebouncedCallback(fn, ms) {
  const t = useRef(null)
  return useCallback(
    (...args) => {
      if (t.current) clearTimeout(t.current)
      t.current = setTimeout(() => {
        t.current = null
        fn(...args)
      }, ms)
    },
    [fn, ms]
  )
}

export function NovaPoshtaDeliverySection({ apiKey: apiKeyProp, deliveryMethod }) {
  const apiKey = String(apiKeyProp ?? '').trim()
  const listId = useId()
  const wrapRef = useRef(null)

  const [cityInput, setCityInput] = useState('')
  const [citySuggestions, setCitySuggestions] = useState([])
  const [cityOpen, setCityOpen] = useState(false)
  const [cityLoading, setCityLoading] = useState(false)
  const [cityError, setCityError] = useState('')

  const [selectedCity, setSelectedCity] = useState(null)

  const [warehouses, setWarehouses] = useState([])
  const [warehouseLoading, setWarehouseLoading] = useState(false)
  const [warehouseError, setWarehouseError] = useState('')
  const [warehouseRef, setWarehouseRef] = useState('')

  /** Щоб після await не підставити відділення від іншого (попереднього) міста */
  const selectedCityLiveRef = useRef(null)
  useEffect(() => {
    selectedCityLiveRef.current = selectedCity
  }, [selectedCity])

  const runCitySearch = useCallback(
    async (q) => {
      if (!apiKey || q.trim().length < 2) {
        setCitySuggestions([])
        setCityLoading(false)
        return
      }
      setCityLoading(true)
      setCityError('')
      try {
        const list = await searchCities(apiKey, q)
        setCitySuggestions(list)
        setCityOpen(true)
      } catch (e) {
        setCitySuggestions([])
        setCityError(e instanceof Error ? e.message : 'Помилка')
      } finally {
        setCityLoading(false)
      }
    },
    [apiKey]
  )

  const debouncedSearch = useDebouncedCallback(runCitySearch, DEBOUNCE_MS)

  useEffect(() => {
    if (!selectedCity) {
      debouncedSearch(cityInput)
    }
  }, [cityInput, selectedCity, debouncedSearch])

  useEffect(() => {
    let cancelled = false

    async function loadWarehouses() {
      if (!selectedCity || !apiKey || deliveryMethod !== 'np_branch') {
        await Promise.resolve()
        if (cancelled) return
        setWarehouses([])
        setWarehouseRef('')
        setWarehouseError('')
        setWarehouseLoading(false)
        return
      }

      const loadForRef = selectedCity.Ref

      const fromCache = peekWarehousesForPick(selectedCity)
      if (fromCache !== null) {
        if (!cancelled) {
          setWarehouses(fromCache)
          setWarehouseRef('')
          setWarehouseError('')
          setWarehouseLoading(false)
        }
        return
      }

      setWarehouseLoading(true)
      setWarehouseError('')
      setWarehouseRef('')
      setWarehouses([])

      try {
        const list = await fetchWarehousesForPick(apiKey, selectedCity)
        if (cancelled) return
        const still = selectedCityLiveRef.current
        if (!still || still.Ref !== loadForRef) return
        setWarehouses(list)
      } catch (e) {
        if (cancelled) return
        const still = selectedCityLiveRef.current
        if (!still || still.Ref !== loadForRef) return
        setWarehouseError(e instanceof Error ? e.message : 'Помилка')
        setWarehouses([])
      } finally {
        if (!cancelled && selectedCityLiveRef.current?.Ref === loadForRef) {
          setWarehouseLoading(false)
        }
      }
    }

    void loadWarehouses()
    return () => {
      cancelled = true
    }
  }, [selectedCity, apiKey, deliveryMethod])

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!wrapRef.current?.contains(e.target)) {
        setCityOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function pickCity(c) {
    setSelectedCity(c)
    setCityInput(c.Description)
    setCitySuggestions([])
    setCityOpen(false)
    setCityError('')
  }

  function clearCity() {
    setSelectedCity(null)
    setCityInput('')
    setWarehouseRef('')
    setWarehouses([])
    setCitySuggestions([])
    setCityOpen(false)
  }

  const branchRequired = deliveryMethod === 'np_branch'

  if (!apiKey) {
    return (
      <>
        <div className="checkout-npWarn" role="status">
          Додайте ключ API у файл <code className="checkout-npWarn__code">.env</code>:{' '}
          <code className="checkout-npWarn__code">VITE_NOVA_POSHTA_API_KEY</code> (особистий кабінет Нової пошти →
          Налаштування → API). Поки ключа немає — введіть місто та відділення вручну.
        </div>
        <label className="checkout-field">
          <span className="checkout-field__label">
            Місто<span className="checkout-field__req"> *</span>
          </span>
          <input className="checkout__input" name="city" type="text" required placeholder="Наприклад, Київ" />
        </label>
        <label className="checkout-field">
          <span className="checkout-field__label">
            Відділення Нової пошти<span className="checkout-field__req"> *</span>
          </span>
          <input
            className="checkout__input"
            name="branch"
            type="text"
            required={branchRequired}
            placeholder="Номер або адреса відділення"
          />
        </label>
      </>
    )
  }

  return (
    <>
      <input type="hidden" name="city" value={selectedCity?.Description || ''} required />
      <input type="hidden" name="cityRef" value={selectedCity?.Ref || ''} />

      <div className="checkout-field checkout-npCity" ref={wrapRef}>
        <span className="checkout-field__label" id={`${listId}-city-label`}>
          Місто<span className="checkout-field__req"> *</span>
        </span>
        <div className="checkout-npCity__row">
          <input
            id={`${listId}-city`}
            className="checkout__input"
            type="text"
            autoComplete="off"
            aria-labelledby={`${listId}-city-label`}
            aria-autocomplete="list"
            aria-expanded={cityOpen}
            aria-controls={`${listId}-list`}
            value={cityInput}
            onChange={(e) => {
              const v = e.target.value
              if (selectedCity && v !== selectedCity.Description) {
                setSelectedCity(null)
                setWarehouseRef('')
                setWarehouses([])
                setCityInput(v)
                if (v.trim().length >= 2) setCityOpen(true)
                return
              }
              setCityInput(v)
              if (v.trim().length >= 2) setCityOpen(true)
            }}
            onFocus={() => {
              if (!selectedCity && cityInput.trim().length >= 2) setCityOpen(true)
            }}
            placeholder="Почніть вводити назву…"
          />
          {selectedCity ? (
            <button type="button" className="checkout-npCity__change" onClick={clearCity}>
              Змінити
            </button>
          ) : null}
        </div>
        {cityError ? <p className="checkout-npError">{cityError}</p> : null}
        {cityOpen && !selectedCity && cityInput.trim().length >= 2 ? (
          <ul id={`${listId}-list`} className="checkout-npSuggest" role="listbox">
            {cityLoading ? (
              <li className="checkout-npSuggest__empty" role="presentation">
                Пошук міст…
              </li>
            ) : citySuggestions.length === 0 ? (
              <li className="checkout-npSuggest__empty" role="presentation">
                Нічого не знайдено. Спробуйте інші літери (наприклад «Киї»).
              </li>
            ) : (
              citySuggestions.map((c) => (
                <li key={c.Ref} role="option">
                  <button type="button" className="checkout-npSuggest__btn" onMouseDown={() => pickCity(c)}>
                    <span className="checkout-npSuggest__title">{c.Description}</span>
                    {c.AreaDescription ? (
                      <span className="checkout-npSuggest__meta">{c.AreaDescription}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {deliveryMethod === 'np_branch' ? (
        <label className="checkout-field">
          <span className="checkout-field__label">
            Відділення Нової пошти<span className="checkout-field__req"> *</span>
          </span>
          {selectedCity ? (
            <p className="checkout-npBranchScope">
              Лише для: <strong>{selectedCity.Description}</strong>
            </p>
          ) : null}
          {!selectedCity ? (
            <p className="checkout-npHint">Спочатку оберіть місто зі списку — тоді тут з’являться відділення саме для нього.</p>
          ) : warehouseLoading ? (
            <div className="checkout-npLoading" role="status" aria-live="polite" aria-busy="true">
              <span className="checkout-npSpinnerWave" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span>Завантаження відділень для «{selectedCity.Description}»…</span>
            </div>
          ) : warehouseError ? (
            <p className="checkout-npError">{warehouseError}</p>
          ) : warehouses.length === 0 ? (
            <>
              <p className="checkout-npError">Відділень Нової пошти для цього міста не знайдено.</p>
              <input type="hidden" name="branchDescription" value="" />
              <input type="hidden" name="branchRef" value="" />
              <select className="checkout__select" name="branch" required={branchRequired} value="">
                <option value="">Оберіть інше місто</option>
              </select>
            </>
          ) : (
            <>
              <input
                type="hidden"
                name="branchDescription"
                value={warehouses.find((w) => w.Ref === warehouseRef)?.Description || ''}
              />
              <input type="hidden" name="branchRef" value={warehouseRef} />
              <select
                className="checkout__select"
                name="branch"
                required={branchRequired}
                value={warehouseRef}
                onChange={(e) => setWarehouseRef(e.target.value)}
              >
                <option value="">Оберіть відділення…</option>
                {warehouses.map((w) => (
                  <option key={w.Ref} value={w.Ref}>
                    {w.Description}
                  </option>
                ))}
              </select>
            </>
          )}
        </label>
      ) : (
        <>
          <input type="hidden" name="branch" value="Кур’єр — без відділення" />
          <input type="hidden" name="branchRef" value="" />
          <input type="hidden" name="branchDescription" value="Кур’єр — без відділення" />
        </>
      )}
    </>
  )
}
