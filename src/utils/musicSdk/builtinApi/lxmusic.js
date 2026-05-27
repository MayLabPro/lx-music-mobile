import { createMusicUrlApi, mapApiError } from './shared'

const API_URL = 'https://88.lxmusic.xn--fiqs8s'
const API_KEY = 'lxmusic'
const SUPPORT_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg']

const parseBody = (body, quality) => {
  if (!body || isNaN(Number(body.code))) throw new Error('unknown error')
  if (body.code == 0) {
    if (!body.data) throw new Error('get music url failed')
    return { type: quality, url: body.data }
  }
  throw mapApiError(body.code, body.msg)
}

const lxmusicApis = SUPPORT_SOURCES.reduce((apis, source) => {
  apis[`lxmusic_api_${source}`] = createMusicUrlApi({
    source,
    getUrl: (source, songId, quality) => `${API_URL}/url/${source}/${songId}/${quality}`,
    getHeaders: () => ({ 'X-Request-Key': API_KEY }),
    parseBody,
  })
  return apis
}, {})

export default lxmusicApis
