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

function getLs() {
  if (typeof window === 'undefined' || !window.localStorage) return null
  return window.localStorage
}

/** Ключі localStorage (переживають F5); значення — JSON { t, list|data }. */
const LS_WH_PREFIX = 'lumiq_np_wh:'
/** Готовий список відділень для конкретного обраного пункту (pick.Ref) — швидко після F5. */
const LS_WH_PICK_PREFIX = 'lumiq_np_wh_pick:'
const LS_CITY_PREFIX = 'lumiq_np_city:'

/** @type {Map<string, { t: number, list: { Ref: string, Description: string }[] }>} */
const whPickCache = new Map()

/**
 * @param {string} prefix
 * @param {string} ck
 */
function lsReadEntry(prefix, ck, ttlMs) {
  const ls = getLs()
  if (!ls) return null
  try {
    const raw = ls.getItem(prefix + ck)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.t !== 'number') return null
    if (Date.now() - parsed.t >= ttlMs) {
      ls.removeItem(prefix + ck)
      return null
    }
    return parsed
  } catch {
    try {
      ls.removeItem(prefix + ck)
    } catch {
      /* ignore */
    }
    return null
  }
}

/**
 * @param {string} prefix
 * @param {string} ck
 * @param {{ t: number, list?: unknown[], data?: unknown[] }} payload
 */
function lsWriteEntry(prefix, ck, payload) {
  const ls = getLs()
  if (!ls) return
  try {
    ls.setItem(prefix + ck, JSON.stringify(payload))
  } catch (e) {
    const name = /** @type {{ name?: string, code?: number }} */ (e).name
    const code = /** @type {{ name?: string, code?: number }} */ (e).code
    if (name === 'QuotaExceededError' || code === 22) {
      lsPruneNpKeys(LS_WH_PREFIX)
      lsPruneNpKeys(LS_WH_PICK_PREFIX)
      lsPruneNpKeys(LS_CITY_PREFIX)
      try {
        ls.setItem(prefix + ck, JSON.stringify(payload))
      } catch {
        /* ignore */
      }
    }
  }
}

/** Видаляє половину найстаріших записів з префіксом (звільнення квоти). */
function lsPruneNpKeys(prefix) {
  const ls = getLs()
  if (!ls) return
  const keys = []
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i)
    if (k && k.startsWith(prefix)) keys.push(k)
  }
  const meta = keys
    .map((k) => {
      try {
        const v = JSON.parse(ls.getItem(k) || '{}')
        return { k, t: typeof v.t === 'number' ? v.t : 0 }
      } catch {
        return { k, t: 0 }
      }
    })
    .sort((a, b) => a.t - b.t)
  const drop = Math.max(1, Math.ceil(meta.length / 2))
  for (let i = 0; i < drop; i++) {
    try {
      ls.removeItem(meta[i].k)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Кеш відділень по CityRef (наприклад Київ — один раз завантажили, далі з пам’яті).
 * TTL 12 год — потім знову запит до НП.
 */
const WH_CACHE_TTL_MS = 12 * 60 * 60 * 1000
/** Префікс версії кешу (зміна формату / TTL — нове завантаження). */
const WH_CACHE_VER = 'v5:'
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

/** Кеш результатів пошуку міст (той самий рядок у полі — без повторного запиту до НП). TTL 1 год. */
const CITY_SEARCH_CACHE_TTL_MS = 60 * 60 * 1000
const CITY_SEARCH_CACHE_MAX = 120
const CITY_SEARCH_CACHE_VER = 'c1:'
/** @type {Map<string, { t: number, data: CityPick[] }>} */
const citySearchCache = new Map()
/** @type {Map<string, Promise<CityPick[]>>} */
const citySearchInflight = new Map()

function citySearchCacheKey(qTrimmed) {
  return `${CITY_SEARCH_CACHE_VER}${qTrimmed.toLowerCase()}`
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
 * Прямий запит до НП (без кешу). `q` — уже trim і довжина ≥ 2.
 * @param {string} apiKey
 * @param {string} q
 * @returns {Promise<CityPick[]>}
 */
async function fetchSearchCitiesFromApi(apiKey, q) {
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

/**
 * Онлайн-пошук населених пунктів + getCities; результати кешуються в пам’яті браузера (TTL + ліміт записів).
 * @param {string} apiKey
 * @param {string} findByString
 * @returns {Promise<CityPick[]>}
 */
export async function searchCities(apiKey, findByString) {
  const q = findByString.trim()
  if (q.length < 2) return []

  const ck = citySearchCacheKey(q)
  const hit = citySearchCache.get(ck)
  if (hit && Date.now() - hit.t < CITY_SEARCH_CACHE_TTL_MS) {
    return hit.data.map((c) => ({ ...c }))
  }

  const lsCity = lsReadEntry(LS_CITY_PREFIX, ck, CITY_SEARCH_CACHE_TTL_MS)
  if (lsCity && Array.isArray(lsCity.data)) {
    const entry = { t: lsCity.t, data: /** @type {CityPick[]} */ (lsCity.data) }
    citySearchCache.set(ck, entry)
    return entry.data.map((c) => ({ ...c }))
  }

  const inflight = citySearchInflight.get(ck)
  if (inflight) {
    const data = await inflight
    return data.map((c) => ({ ...c }))
  }

  const p = (async () => {
    const data = await fetchSearchCitiesFromApi(apiKey, q)
    const now = Date.now()
    citySearchCache.set(ck, { t: now, data })
    lsWriteEntry(LS_CITY_PREFIX, ck, { t: now, data })
    while (citySearchCache.size > CITY_SEARCH_CACHE_MAX) {
      const oldest = citySearchCache.keys().next().value
      if (oldest === undefined) break
      citySearchCache.delete(oldest)
    }
    return data
  })().finally(() => {
    citySearchInflight.delete(ck)
  })

  citySearchInflight.set(ck, p)
  const data = await p
  return data.map((c) => ({ ...c }))
}

const WH_PAGE_LIMIT = '500'

async function fetchWarehousesPaged(apiKey, methodProperties) {
  const out = []
  /** З Limit=500 зазвичало 1–3 сторінки; якщо НП ігнорує Limit — більше сторінок по 50+ записів */
  const maxPages = 15

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await sleep(45)

    let json
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) await sleep(400 + attempt * 400)

      json = await npRequest(apiKey, 'Address', 'getWarehouses', {
        ...methodProperties,
        Page: String(page),
        Limit: WH_PAGE_LIMIT,
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

  const lsWh = lsReadEntry(LS_WH_PREFIX, ck, WH_CACHE_TTL_MS)
  if (lsWh && Array.isArray(lsWh.list)) {
    const entry = {
      t: lsWh.t,
      list: /** @type {{ Ref: string, Description: string, npCityRef?: string }[]} */ (lsWh.list),
    }
    whCache.set(ck, entry)
    return entry.list.map((w) => ({ ...w }))
  }

  const existing = whInflight.get(ck)
  if (existing) {
    const list = await existing
    return list.map((w) => ({ ...w }))
  }

  const p = (async () => {
    const list = await fetchWarehousesPaged(apiKey, { CityRef: cityRef })
    const now = Date.now()
    const payload = { t: now, list }
    whCache.set(ck, payload)
    lsWriteEntry(LS_WH_PREFIX, ck, payload)
    return list
  })().finally(() => {
    whInflight.delete(ck)
  })

  whInflight.set(ck, p)
  const list = await p
  return list.map((w) => ({ ...w }))
}

/**
 * @param {{ npCityRef?: string, Ref: string, Description: string }[]} raw
 * @param {CityPick} pick
 */
function applyWarehousesPickFilter(raw, pick) {
  const cityRef = pick.warehouseCityRef || pick.Ref
  const settlementRef = pick.Ref
  const filtered = raw.filter((w) => {
    const cr = w.npCityRef
    if (!cr) return true
    if (cr === cityRef) return true
    if (settlementRef && cr === settlementRef) return true
    return false
  })
  return filtered.map(({ Ref, Description }) => ({ Ref, Description }))
}

/**
 * Синхронно: чи є вже готовий список відділень (RAM / localStorage по pick.Ref / сирий кеш по місту).
 * @param {CityPick} pick
 * @returns {{ Ref: string, Description: string }[] | null} null — треба мережа
 */
export function peekWarehousesForPick(pick) {
  const pickKey = pick.Ref
  const memPick = whPickCache.get(pickKey)
  if (memPick && Date.now() - memPick.t < WH_CACHE_TTL_MS) {
    return memPick.list.map((w) => ({ ...w }))
  }

  const lsPick = lsReadEntry(LS_WH_PICK_PREFIX, pickKey, WH_CACHE_TTL_MS)
  if (lsPick && Array.isArray(lsPick.list)) {
    const list = /** @type {{ Ref: string, Description: string }[]} */ (lsPick.list)
    whPickCache.set(pickKey, { t: lsPick.t, list })
    return list.map((w) => ({ ...w }))
  }

  const cityRef = pick.warehouseCityRef || pick.Ref
  const ck = whCacheKey(cityRef)
  const mem = whCache.get(ck)
  if (mem && Date.now() - mem.t < WH_CACHE_TTL_MS) {
    return applyWarehousesPickFilter(mem.list, pick)
  }

  const lsWh = lsReadEntry(LS_WH_PREFIX, ck, WH_CACHE_TTL_MS)
  if (lsWh && Array.isArray(lsWh.list)) {
    const list = /** @type {{ Ref: string, Description: string, npCityRef?: string }[]} */ (lsWh.list)
    whCache.set(ck, { t: lsWh.t, list })
    return applyWarehousesPickFilter(list, pick)
  }

  return null
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
  const raw = await fetchWarehousesForCity(apiKey, cityRef)
  const out = applyWarehousesPickFilter(raw, pick)
  const now = Date.now()
  whPickCache.set(pick.Ref, { t: now, list: out })
  lsWriteEntry(LS_WH_PICK_PREFIX, pick.Ref, { t: now, list: out })
  return out
}
