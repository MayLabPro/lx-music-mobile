import { createMusicUrlApi, mapApiError } from './shared'

const API_URL = 'http://103.40.13.21:9866'
const API_KEY = 'nya'
const SUPPORT_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg']

const parseBody = (body, quality) => {
  if (!body || isNaN(Number(body.code))) throw new Error('unknown error')
  if (body.code == 0) {
    if (!body.data) throw new Error('get music url failed')
    return { type: quality, url: body.data }
  }
  throw mapApiError(body.code, body.msg)
}

const nyaApis = SUPPORT_SOURCES.reduce((apis, source) => {
  apis[`nya_api_${source}`] = createMusicUrlApi({
    source,
    getUrl: (source, songId, quality) => `${API_URL}/url/${source}/${songId}/${quality}`,
    getHeaders: () => ({ 'X-Request-Key': API_KEY }),
    parseBody,
  })
  return apis
}, {})

export default nyaApis
