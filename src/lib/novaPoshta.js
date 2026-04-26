/** Клієнт JSON API 2.0 «Нова пошта» (https://api.novaposhta.ua/v2.0/json/) */

const DEFAULT_URL = 'https://api.novaposhta.ua/v2.0/json/'

/** URL JSON API: у `npm run dev` за замовчуванням той самий origin + проксі Vite (без CORS). */
export function getNovaPoshtaEndpoint() {
  const fromEnv = import.meta.env.VITE_NOVA_POSHTA_API_URL
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/?$/, '/')
  }
  if (import.meta.env.DEV) {
    return '/np-api/'
  }
  return DEFAULT_URL
}

/**
 * @param {string} apiKey
 * @param {string} modelName
 * @param {string} calledMethod
 * @param {Record<string, unknown>} [methodProperties]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function npRequest(apiKey, modelName, calledMethod, methodProperties = {}) {
  const url = getNovaPoshtaEndpoint()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      modelName,
      calledMethod,
      language: 'uk',
      methodProperties,
    }),
  })
  if (!res.ok) {
    throw new Error(`Нова пошта: HTTP ${res.status}`)
  }
  return res.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Кеш відділень по CityRef — менше запитів при повторному виборі / React Strict Mode. */
const WH_CACHE_TTL_MS = 12 * 60 * 1000
/** Префікс версії кешу (після зміни формату списку — нове завантаження). */
const WH_CACHE_VER = 'v3:'
/** @type {Map<string, { t: number, list: { Ref: string, Description: string, npCityRef?: string }[] }>} */
const whCache = new Map()
/** @type {Map<string, Promise<{ Ref: string, Description: string, npCityRef?: string }[]>>} */
const whInflight = new Map()

function whCacheKey(cityRef) {
  return `${WH_CACHE_VER}${cityRef}`
}

function isRateLimitedNpResponse(json) {
  const err = Array.isArray(json.errors) ? json.errors.join(' ') : ''
  const warn = Array.isArray(json.warnings) ? json.warnings.join(' ') : ''
  let infoStr = ''
  if (Array.isArray(json.info)) infoStr = json.info.join(' ')
  else if (json.info != null) infoStr = String(json.info)
  const parts = `${err} ${warn} ${infoStr}`
  return /too\s+many|many\s+requests|забагато|часті\s+запити|rate|429/i.test(parts)
}

/**
 * Ref населеного пункту (для форми); warehouseCityRef — CityRef для getWarehouses (у searchSettlements це зазвичай DeliveryCity).
 * @typedef {{
 *   Ref: string,
 *   Description: string,
 *   AreaDescription?: string,
 *   warehouseBy: 'city' | 'settlement',
 *   warehouseCityRef: string,
 * }} CityPick
 */

/**
 * Онлайн-пошук населених пунктів + довідник міст (getCities), об’єднано без дублікатів Ref.
 * @param {string} apiKey
 * @param {string} findByString
 * @returns {Promise<CityPick[]>}
 */
export async function searchCities(apiKey, findByString) {
  const q = findByString.trim()
  if (q.length < 2) return []

  /** @type {Map<string, CityPick>} */
  const merged = new Map()

  try {
    const ss = await npRequest(apiKey, 'Address', 'searchSettlements', {
      CityName: q,
      Limit: '25',
    })
    if (ss.success && Array.isArray(ss.data) && ss.data.length > 0) {
      const addresses = ss.data[0]?.Addresses
      if (Array.isArray(addresses)) {
        for (const item of addresses) {
          const ref = item.Ref
          if (!ref || merged.has(ref)) continue
          const desc = item.Present || item.MainDescription || item.Description || ''
          if (!desc) continue
          const area = [item.Area, item.SettlementTypeDescription || item.SettlementType, item.Region]
            .filter(Boolean)
            .join(', ')
          const cityRefForWh =
            item.DeliveryCity || item.CityRef || item.ParentRef || item.PrimaryCityRef || item.Ref
          merged.set(ref, {
            Ref: ref,
            Description: desc,
            AreaDescription: area || undefined,
            warehouseBy: 'settlement',
            warehouseCityRef: cityRefForWh,
          })
        }
      }
    }
  } catch {
    /* searchSettlements може бути недоступний у старих ключах — тоді лишаємось на getCities */
  }

  const gc = await npRequest(apiKey, 'Address', 'getCities', {
    FindByString: q,
    Page: '0',
  })

  if (!gc.success) {
    const err = Array.isArray(gc.errors) ? gc.errors.join('; ') : 'Помилка пошуку міста'
    throw new Error(err)
  }

  const cityRows = Array.isArray(gc.data) ? gc.data : []
  for (const row of cityRows) {
    const ref = row.Ref
    if (!ref || merged.has(ref)) continue
    merged.set(ref, {
      Ref: ref,
      Description: row.Description || row.Present || '',
      AreaDescription: row.AreaDescription || row.SettlementTypeDescription || '',
      warehouseBy: 'city',
      warehouseCityRef: ref,
    })
  }

  return Array.from(merged.values()).slice(0, 40)
}

async function fetchWarehousesPaged(apiKey, methodProperties) {
  const out = []
  const maxPages = 22

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await sleep(140)

    let json
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) await sleep(500 + attempt * 450)

      json = await npRequest(apiKey, 'Address', 'getWarehouses', {
        ...methodProperties,
        Page: String(page),
      })

      if (json.success) break
      if (isRateLimitedNpResponse(json) && attempt < 5) continue
      if (isRateLimitedNpResponse(json)) {
        throw new Error(
          'Нова пошта обмежує кількість запитів. Зачекайте 1–2 хвилини, натисніть «Змінити» біля міста й оберіть місто знову.'
        )
      }

      const err = Array.isArray(json.errors) ? json.errors.join('; ') : 'Помилка завантаження відділень'
      throw new Error(err)
    }

    if (!json?.success) {
      throw new Error('Нова пошта: неочікувана відповідь при завантаженні відділень')
    }

    const chunk = Array.isArray(json.data) ? json.data : []
    if (!chunk.length) break

    for (const row of chunk) {
      out.push({
        Ref: row.Ref,
        Description: row.Description || '',
        /** Ref міста в НП (для відсікання чужих відділень, якщо API поверне зайве) */
        npCityRef: row.CityRef || row.SettlementRef || '',
      })
    }
  }

  const uniq = [...new Map(out.map((w) => [w.Ref, w])).values()]
  uniq.sort((a, b) => a.Description.localeCompare(b.Description, 'uk'))
  return uniq
}

/**
 * Відділення за довідником міст (CityRef).
 * @param {string} apiKey
 * @param {string} cityRef
 */
export async function fetchWarehousesForCity(apiKey, cityRef) {
  const ck = whCacheKey(cityRef)
  const hit = whCache.get(ck)
  if (hit && Date.now() - hit.t < WH_CACHE_TTL_MS) {
    return hit.list.map((w) => ({ ...w }))
  }

  const existing = whInflight.get(ck)
  if (existing) {
    const list = await existing
    return list.map((w) => ({ ...w }))
  }

  const p = (async () => {
    const list = await fetchWarehousesPaged(apiKey, { CityRef: cityRef })
    whCache.set(ck, { t: Date.now(), list })
    return list
  })().finally(() => {
    whInflight.delete(ck)
  })

  whInflight.set(ck, p)
  const list = await p
  return list.map((w) => ({ ...w }))
}

/**
 * Відділення для обраного пункту (завжди через Address/getWarehouses + CityRef).
 * Для рядків із searchSettlements у CityRef підставляється DeliveryCity (або запасні поля з відповіді НП).
 * Після завантаження лишаються лише рядки, де CityRef збігається з обраним містом (якщо НП повернув поле).
 * @param {string} apiKey
 * @param {CityPick} pick
 */
export async function fetchWarehousesForPick(apiKey, pick) {
  const cityRef = pick.warehouseCityRef || pick.Ref
  const settlementRef = pick.Ref
  const raw = await fetchWarehousesForCity(apiKey, cityRef)

  const filtered = raw.filter((w) => {
    const cr = w.npCityRef
    if (!cr) return true
    if (cr === cityRef) return true
    if (settlementRef && cr === settlementRef) return true
    return false
  })

  return filtered.map(({ Ref, Description }) => ({ Ref, Description }))
}
