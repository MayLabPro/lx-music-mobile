// Support qualitys: 128k 320k flac wav

const sources: Array<{
  id: string
  name: string
  disabled: boolean
  supportQualitys: Partial<Record<LX.OnlineSource, LX.Quality[]>>
}> = [
  {
    id: 'huibq',
    name: 'Huibq',
    disabled: false,
    supportQualitys: {
      kw: ['128k', '320k'],
      kg: ['128k', '320k'],
      tx: ['128k', '320k'],
      wy: ['128k', '320k'],
      mg: ['128k', '320k'],
    },
  },
  {
    id: 'ikun',
    name: 'IKun',
    disabled: true,
    supportQualitys: {
      kw: ['128k', '320k', 'flac'],
      kg: ['128k', '320k', 'flac'],
      tx: ['128k', '320k', 'flac'],
      wy: ['128k', '320k', 'flac'],
      mg: ['128k', '320k', 'flac'],
    },
  },
  {
    id: 'lxmusic',
    name: 'LX Music',
    disabled: true,
    supportQualitys: {
      kw: ['128k', '320k', 'flac', 'flac24bit'],
      kg: ['128k', '320k', 'flac', 'flac24bit'],
      tx: ['128k', '320k', 'flac', 'flac24bit'],
      wy: ['128k', '320k', 'flac', 'flac24bit'],
      mg: ['128k', '320k', 'flac', 'flac24bit'],
    },
  },
  {
    id: 'nya',
    name: 'Nya',
    disabled: true,
    supportQualitys: {
      kw: ['128k', '320k', 'flac', 'flac24bit'],
      kg: ['128k'],
      tx: ['128k', '320k', 'flac', 'flac24bit'],
      wy: ['128k', '320k', 'flac', 'flac24bit'],
      mg: ['128k'],
    },
  },
  {
    id: 'yyxzq',
    name: 'YYXZQ',
    disabled: true,
    supportQualitys: {
      kw: ['128k', '320k', 'flac', 'flac24bit'],
      kg: ['128k', '320k', 'flac', 'flac24bit'],
      tx: ['128k', '320k', 'flac', 'flac24bit'],
      wy: ['128k', '320k', 'flac', 'flac24bit'],
      mg: ['128k', '320k', 'flac', 'flac24bit'],
    },
  },
]

export default sources
