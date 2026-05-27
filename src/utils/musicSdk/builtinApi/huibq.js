import { createMusicUrlApi, mapApiError } from './shared'

const API_URL = 'https://lxmusicapi.onrender.com'
const API_KEY = 'share-v3'
const SUPPORT_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg']

const parseBody = (body, quality) => {
  if (!body || isNaN(Number(body.code))) throw new Error('unknown error')
  if (body.code == 0) {
    if (!body.url) throw new Error('get music url failed')
    return { type: quality, url: body.url }
  }
  throw mapApiError(body.code, body.msg)
}

const huibqApis = SUPPORT_SOURCES.reduce((apis, source) => {
  apis[`huibq_api_${source}`] = createMusicUrlApi({
    source,
    getUrl: (source, songId, quality) => `${API_URL}/url/${source}/${songId}/${quality}`,
    getHeaders: () => ({ 'X-Request-Key': API_KEY }),
    parseBody,
  })
  return apis
}, {})

export default huibqApis
