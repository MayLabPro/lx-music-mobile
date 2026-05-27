import { httpFetch } from '@/utils/request'
import { requestMsg } from '@/utils/message'

const getUserAgent = () => {
  const version = globalThis.process?.versions?.app ?? 'unknown'
  return `lx-music-mobile/${version}`
}

export const getSongId = (source, musicInfo, quality) => {
  if (source == 'kg') return musicInfo._types?.[quality]?.hash ?? musicInfo.hash ?? musicInfo.songmid
  if (source == 'mg') return musicInfo.copyrightId ?? musicInfo.songmid
  return musicInfo.songmid
}

export const mapApiError = (code, msg) => {
  switch (Number(code)) {
    case 1:
      return new Error('block ip')
    case 2:
      return new Error('get music url failed')
    case 4:
      return new Error('internal server error')
    case 5:
      return new Error(requestMsg.tooManyRequests)
    case 6:
      return new Error('param error')
    default:
      return new Error(msg ?? 'unknown error')
  }
}

export const createMusicUrlApi = ({
  source,
  getUrl,
  getHeaders,
  parseBody,
}) => ({
  getMusicUrl(musicInfo, quality) {
    const songId = getSongId(source, musicInfo, quality)
    if (!songId) {
      return {
        promise: Promise.reject(new Error('song id missing')),
        cancelHttp() {},
      }
    }

    const requestObj = httpFetch(getUrl(source, songId, quality), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
        ...getHeaders(),
      },
    })

    return {
      promise: requestObj.promise.then(({ body }) => parseBody(body, quality)),
      cancelHttp: requestObj.cancelHttp,
    }
  },
})
