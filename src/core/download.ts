import settingState from '@/store/setting/state'
import { getDownloadList as getDownloadListFromStore, saveDownloadList as saveDownloadListToStore } from '@/utils/data'
import { downloadFile, existsFile, mkdir, privateStorageDirectoryPath, stopDownload, unlink } from '@/utils/fs'
import { arrPush, filterFileName, sizeFormate, throttle } from '@/utils/common'
import { formatMusicName, toast } from '@/utils/tools'
import { getMusicUrl as getOnlineMusicUrl } from './music/online'
import { getPlayQuality } from './music/utils'

const downloadDir = `${privateStorageDirectoryPath}/download`
const urlExtRxp = /\.([a-z0-9]+)(?:[?#].*)?$/i
const supportExts = new Set(['mp3', 'flac', 'wav', 'ape'])

let isInited = false
let isIniting: Promise<void> | null = null
let runningItem: LX.Download.ListItem | null = null
const list: LX.Download.ListItem[] = []
const jobIds = new Map<string, number>()
const removedItems = new WeakSet<LX.Download.ListItem>()

const saveListThrottle = throttle(() => {
  void saveDownloadListToStore(list)
}, 1000)

const emitListUpdate = () => {
  global.app_event.downloadListUpdate()
}

const saveList = async(immediate = false) => {
  emitListUpdate()
  if (immediate) await saveDownloadListToStore(list)
  else saveListThrottle()
}

const isTaskActive = (item: LX.Download.ListItem) => !removedItems.has(item) && list.includes(item)

const assertTaskActive = (item: LX.Download.ListItem) => {
  if (!isTaskActive(item)) throw new Error('download canceled')
}

const hasDownloadFile = async(item: LX.Download.ListItem) => {
  return !!item.metadata.filePath && await existsFile(item.metadata.filePath)
}

const ensureDownloadDir = async() => {
  if (!await existsFile(downloadDir)) await mkdir(downloadDir)
}

const getExtByQuality = (quality: LX.Quality): LX.Download.FileExt => {
  switch (quality) {
    case 'flac':
    case 'flac24bit':
      return 'flac'
    case 'ape':
      return 'ape'
    case 'wav':
      return 'wav'
    case '128k':
    case '192k':
    case '320k':
    default:
      return 'mp3'
  }
}

const getExtByUrl = (url: string, quality: LX.Quality): LX.Download.FileExt => {
  const ext = urlExtRxp.exec(url.split('/').pop() ?? '')?.[1]?.toLowerCase()
  return supportExts.has(ext ?? '') ? ext as LX.Download.FileExt : getExtByQuality(quality)
}

const createTaskId = (musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality) => `${musicInfo.id}__${quality}`

const createFileInfo = (musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality, ext: LX.Download.FileExt) => {
  const title = formatMusicName(settingState.setting['download.fileName'], musicInfo.name, musicInfo.singer)
  const safeTitle = filterFileName(title).trim() || filterFileName(musicInfo.name).trim() || 'music'
  const safeId = filterFileName(`${musicInfo.id}_${quality}`)
  return {
    fileName: `${safeTitle}.${ext}`,
    filePath: `${downloadDir}/${safeId || createTaskId(musicInfo, quality)}.${ext}`,
  }
}

const createListItem = (musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality): LX.Download.ListItem => {
  const ext = getExtByQuality(quality)
  const fileInfo = createFileInfo(musicInfo, quality, ext)
  return {
    id: createTaskId(musicInfo, quality),
    isComplate: false,
    status: 'waiting',
    statusText: 'waiting',
    downloaded: 0,
    total: 0,
    progress: 0,
    speed: '',
    metadata: {
      musicInfo,
      url: null,
      quality,
      ext,
      ...fileInfo,
    },
  }
}

const resetTaskToWaiting = (item: LX.Download.ListItem) => {
  item.status = 'waiting'
  item.statusText = 'waiting'
  item.isComplate = false
  item.progress = 0
  item.downloaded = 0
  item.total = 0
  item.speed = ''
}

const canRestartTask = async(item: LX.Download.ListItem) => {
  return item.status == 'error' || item.status == 'pause' || (item.status == 'completed' && !await hasDownloadFile(item))
}

const setItemInfo = (item: LX.Download.ListItem, info: Partial<LX.Download.ListItem>) => {
  if (!isTaskActive(item)) return
  Object.assign(item, info)
  void saveList()
}

const runNext = () => {
  if (runningItem) return
  const item = list.find(item => item.status == 'waiting')
  if (!item) return
  void runTask(item)
}

const getUrl = async(item: LX.Download.ListItem, isRefresh = false) => {
  assertTaskActive(item)
  setItemInfo(item, { statusText: 'getting_url' })
  return getOnlineMusicUrl({
    musicInfo: item.metadata.musicInfo,
    quality: item.metadata.quality,
    isRefresh,
    allowToggleSource: true,
  })
}

const downloadByUrl = async(item: LX.Download.ListItem, url: string) => {
  assertTaskActive(item)
  await ensureDownloadDir()
  assertTaskActive(item)
  const ext = getExtByUrl(url, item.metadata.quality)
  const fileInfo = createFileInfo(item.metadata.musicInfo, item.metadata.quality, ext)
  item.metadata.ext = ext
  item.metadata.fileName = fileInfo.fileName
  item.metadata.filePath = fileInfo.filePath
  item.metadata.url = url
  if (await existsFile(item.metadata.filePath)) await unlink(item.metadata.filePath)

  let prevTime = Date.now()
  let prevBytes = 0
  const task = downloadFile(url, item.metadata.filePath, {
    progressInterval: 800,
    begin: ({ contentLength }: { contentLength: number }) => {
      if (!isTaskActive(item)) return
      item.total = contentLength > 0 ? contentLength : item.total
      item.statusText = 'downloading'
      void saveList()
    },
    progress: ({ bytesWritten, contentLength }: { bytesWritten: number, contentLength: number }) => {
      if (!isTaskActive(item)) return
      const now = Date.now()
      const useTime = Math.max(now - prevTime, 1)
      const speed = (bytesWritten - prevBytes) / useTime * 1000
      prevTime = now
      prevBytes = bytesWritten
      item.downloaded = bytesWritten
      item.total = contentLength > 0 ? contentLength : item.total
      item.progress = item.total ? Math.min(Math.trunc(bytesWritten / item.total * 100), 99) : 0
      item.speed = `${sizeFormate(speed)}/s`
      void saveList()
    },
  })
  jobIds.set(item.id, task.jobId)
  const result = await task.promise
  assertTaskActive(item)
  if (result.statusCode < 200 || result.statusCode >= 300) throw new Error(`download failed: ${result.statusCode}`)
  if (result.bytesWritten <= 0) throw new Error('download empty file')
  item.downloaded = result.bytesWritten
  if (!item.total) item.total = result.bytesWritten
}

const runTask = async(item: LX.Download.ListItem) => {
  if (!isTaskActive(item)) return
  runningItem = item
  item.status = 'run'
  item.statusText = 'preparing'
  item.isComplate = false
  item.speed = ''
  await saveList()
  try {
    let url = await getUrl(item)
    assertTaskActive(item)
    try {
      await downloadByUrl(item, url)
    } catch (err) {
      url = await getUrl(item, true)
      assertTaskActive(item)
      await downloadByUrl(item, url)
    }
    assertTaskActive(item)
    item.isComplate = true
    item.status = 'completed'
    item.statusText = 'completed'
    item.progress = 100
    item.speed = ''
    if (!item.total) item.total = item.downloaded
    await saveList(true)
  } catch (err: any) {
    if (!isTaskActive(item)) return
    item.status = 'error'
    item.statusText = err.message || 'failed'
    item.speed = ''
    await saveList(true)
  } finally {
    if (runningItem === item) {
      jobIds.delete(item.id)
      runningItem = null
    }
    runNext()
  }
}

export const initDownloadList = async() => {
  if (isInited) return
  if (isIniting) return isIniting
  isIniting = getDownloadListFromStore().then(async items => {
    list.splice(0, list.length)
    let isChanged = false
    for (const item of items) {
      if (item.status == 'run' || item.status == 'waiting') {
        item.status = 'pause'
        item.statusText = 'paused'
        item.speed = ''
        isChanged = true
      }
      if (item.status == 'completed' && !await hasDownloadFile(item)) {
        item.isComplate = false
        item.status = 'pause'
        item.statusText = 'paused'
        item.downloaded = 0
        item.total = 0
        item.progress = 0
        item.speed = ''
        isChanged = true
      }
    }
    arrPush(list, items)
    isInited = true
    if (isChanged) void saveDownloadListToStore(list)
    emitListUpdate()
  }).finally(() => {
    isIniting = null
  })
  return isIniting
}

export const getDownloadList = async() => {
  await initDownloadList()
  return list
}

export const getDownloadListSync = () => list

export const addDownload = async(musicInfo: LX.Music.MusicInfoOnline, quality = getPlayQuality(settingState.setting['player.playQuality'], musicInfo)) => {
  await initDownloadList()
  const id = createTaskId(musicInfo, quality)
  const existsItem = list.find(item => item.id == id)
  if (existsItem) {
    if (await canRestartTask(existsItem)) {
      resetTaskToWaiting(existsItem)
      void saveList()
      runNext()
    }
    return existsItem
  }
  const item = createListItem(musicInfo, quality)
  list.unshift(item)
  await saveList(true)
  runNext()
  return item
}

export const addDownloads = async(musicInfos: LX.Music.MusicInfoOnline[]) => {
  await initDownloadList()
  let count = 0
  for (const musicInfo of musicInfos) {
    const quality = getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
    const id = createTaskId(musicInfo, quality)
    const existsItem = list.find(item => item.id == id)
    if (existsItem) {
      if (await canRestartTask(existsItem)) {
        resetTaskToWaiting(existsItem)
        count++
      }
      continue
    }
    list.unshift(createListItem(musicInfo, quality))
    count++
  }
  if (count) {
    await saveList(true)
    runNext()
  }
  return count
}

export const retryDownload = async(id: string) => {
  await initDownloadList()
  const item = list.find(item => item.id == id)
  if (!item || item.status == 'run') return
  resetTaskToWaiting(item)
  await saveList(true)
  runNext()
}

export const removeDownloads = async(ids: string[]) => {
  await initDownloadList()
  for (const id of ids) {
    const jobId = jobIds.get(id)
    if (jobId) {
      stopDownload(jobId)
      jobIds.delete(id)
    }
    const index = list.findIndex(item => item.id == id)
    if (index < 0) continue
    const [item] = list.splice(index, 1)
    removedItems.add(item)
    if (item.metadata.filePath && await existsFile(item.metadata.filePath)) {
      await unlink(item.metadata.filePath).catch(() => {})
    }
    if (runningItem === item) runningItem = null
  }
  await saveList(true)
  runNext()
}

export const assertDownloadFile = async(item: LX.Download.ListItem) => {
  return hasDownloadFile(item)
}

export const showDownloadQueuedTip = (count: number) => {
  if (count > 0) toast(global.i18n.t('download_tip_added', { count }))
  else toast(global.i18n.t('download_tip_exists'))
}
