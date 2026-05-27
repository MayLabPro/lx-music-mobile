import { createMusicUrlApi, mapApiError } from './shared'

const API_URL = 'https://api.v2.sukimon.me:19742'
const API_KEY = 'LXMusic_dmsowplaeq'
const SUPPORT_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg']

const parseBody = (body, quality) => {
  if (!body || isNaN(Number(body.code))) throw new Error('unknown error')
  if (body.code == 0) {
    const url = body.data ?? body.url
    if (!url) throw new Error('get music url failed')
    return { type: quality, url }
  }
  throw mapApiError(body.code, body.msg)
}

const yyxzqApis = SUPPORT_SOURCES.reduce((apis, source) => {
  apis[`yyxzq_api_${source}`] = createMusicUrlApi({
    source,
    getUrl: (source, songId, quality) => `${API_URL}/QAQ/url/${source}/${songId}/${quality}`,
    getHeaders: () => ({ 'X-Request-Key': API_KEY }),
    parseBody,
  })
  return apis
}, {})

export default yyxzqApis
