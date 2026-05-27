import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, type FlatListProps } from 'react-native'
import type { ViewStyle } from 'react-native'
import { LIST_IDS, LIST_ITEM_HEIGHT } from '@/config/constant'
import { assertDownloadFile, getDownloadList, retryDownload, removeDownloads } from '@/core/download'
import { playList } from '@/core/player/player'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n, type Message } from '@/lang'
import Text from '@/components/common/Text'
import Badge from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import { createStyle, confirmDialog } from '@/utils/tools'
import { getRowInfo } from '@/utils/tools'
import { sizeFormate } from '@/utils/common'
import { scaleSizeH } from '@/utils/pixelRatio'

const ITEM_HEIGHT = scaleSizeH(LIST_ITEM_HEIGHT)
type FlatListType = FlatListProps<LX.Download.ListItem>

const statusTextMap: Record<LX.Download.DownloadTaskStatus, keyof Message> = {
  run: 'download_status_run',
  waiting: 'download_status_waiting',
  pause: 'download_status_paused',
  error: 'download_status_error',
  completed: 'download_status_completed',
}
const statusTextKeyMap: Record<string, keyof Message> = {
  waiting: 'download_status_waiting',
  getting_url: 'download_status_getting_url',
  downloading: 'download_status_downloading',
  preparing: 'download_status_preparing',
  paused: 'download_status_paused',
  completed: 'download_status_completed',
  missing_file: 'download_status_missing_file',
}

const useDownloadList = () => {
  const [list, setList] = useState<LX.Download.ListItem[]>([])
  const [playableIds, setPlayableIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let isUnmounted = false
    const update = () => {
      void getDownloadList().then(async list => {
        if (isUnmounted) return
        const nextList = [...list]
        setList(nextList)
        const ids = new Set<string>()
        await Promise.all(nextList.map(async item => {
          if (item.status == 'completed' && await assertDownloadFile(item)) ids.add(item.id)
        }))
        if (!isUnmounted) setPlayableIds(ids)
      })
    }
    update()
    global.app_event.on('downloadListUpdate', update)
    return () => {
      isUnmounted = true
      global.app_event.off('downloadListUpdate', update)
    }
  }, [])

  return { list, playableIds }
}

const useActiveIndex = () => {
  const playMusicInfo = usePlayMusicInfo()
  const playInfo = usePlayInfo()
  return playMusicInfo.listId == LIST_IDS.DOWNLOAD ? playInfo.playIndex : -1
}

const getProgressText = (item: LX.Download.ListItem) => {
  if (item.total > 0) return `${sizeFormate(item.downloaded)} / ${sizeFormate(item.total)}`
  if (item.downloaded > 0) return sizeFormate(item.downloaded)
  return ''
}

const ListItem = ({ item, index, activeIndex, rowWidth, onPlay, onRetry, onRemove, isPlayable }: {
  item: LX.Download.ListItem
  index: number
  activeIndex: number
  rowWidth: ViewStyle['width']
  onPlay: (index: number) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
  isPlayable: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  const active = activeIndex == index
  const musicInfo = item.metadata.musicInfo
  const progressText = getProgressText(item)
  const canPlay = item.status == 'completed' && isPlayable
  const isMissingFile = item.status == 'completed' && !isPlayable
  const canRetry = item.status == 'error' || item.status == 'pause' || isMissingFile
  const rawStatusText = isMissingFile ? 'missing_file' : item.statusText
  const statusText = rawStatusText && rawStatusText != item.status
    ? statusTextKeyMap[rawStatusText] ? t(statusTextKeyMap[rawStatusText]) : rawStatusText
    : t(statusTextMap[item.status])

  return (
    <View style={{ ...styles.listItem, width: rowWidth, height: ITEM_HEIGHT }}>
      <TouchableOpacity
        disabled={!canPlay}
        style={{ ...styles.listItemLeft, opacity: canPlay ? 1 : 0.72 }}
        onPress={() => { onPlay(index) }}
      >
        {
          active
            ? <Icon style={styles.sn} name="play-outline" size={13} color={theme['c-primary-font']} />
            : <Text style={styles.sn} size={13} color={theme['c-300']}>{index + 1}</Text>
        }
        <View style={styles.itemInfo}>
          <Text color={active ? theme['c-primary-font'] : theme['c-font']} numberOfLines={1}>{musicInfo.name}</Text>
          <View style={styles.itemMeta}>
            <Badge type={item.status == 'completed' ? 'secondary' : item.status == 'error' ? 'tertiary' : 'normal'}>{statusText}</Badge>
            <Text style={styles.itemMetaText} size={11} color={active ? theme['c-primary-alpha-200'] : theme['c-500']} numberOfLines={1}>
              {musicInfo.singer}
            </Text>
          </View>
        </View>
        <View style={styles.progressInfo}>
          <Text size={11} color={theme['c-400']} numberOfLines={1}>{item.speed || `${item.progress}%`}</Text>
          <Text size={10} color={theme['c-300']} numberOfLines={1}>{progressText}</Text>
        </View>
      </TouchableOpacity>
      {
        canRetry
          ? (
              <TouchableOpacity onPress={() => { onRetry(item.id) }} style={styles.iconButton}>
                <Icon name="available_updates" style={{ color: theme['c-350'] }} size={12} />
              </TouchableOpacity>
            )
          : null
      }
      <TouchableOpacity onPress={() => { onRemove(item.id) }} style={styles.iconButton}>
        <Icon name="remove" style={{ color: theme['c-350'] }} size={12} />
      </TouchableOpacity>
    </View>
  )
}

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const { list, playableIds } = useDownloadList()
  const activeIndex = useActiveIndex()
  const rowInfo = useRef(getRowInfo())

  const handlePlay = useCallback((index: number) => {
    void playList(LIST_IDS.DOWNLOAD, index)
  }, [])

  const handleRetry = useCallback((id: string) => {
    void retryDownload(id)
  }, [])

  const handleRemove = useCallback((id: string) => {
    const item = list.find(item => item.id == id)
    void confirmDialog({
      message: t('download_remove_tip', { name: item?.metadata.musicInfo.name ?? '' }),
      confirmButtonText: t('list_remove_tip_button'),
    }).then(confirm => {
      if (!confirm) return
      void removeDownloads([id])
    })
  }, [list, t])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      activeIndex={activeIndex}
      rowWidth={rowInfo.current.rowWidth}
      onPlay={handlePlay}
      onRetry={handleRetry}
      onRemove={handleRemove}
      isPlayable={playableIds.has(item.id)}
    />
  )
  const emptyComponent = useMemo(() => (
    <View style={styles.empty}>
      <Icon name="download-2" size={30} color={theme['c-300']} />
      <Text style={styles.emptyText} color={theme['c-500']}>{t('download_empty')}</Text>
    </View>
  ), [t, theme])

  return (
    <FlatList
      style={styles.list}
      data={list}
      numColumns={rowInfo.current.rowNum}
      horizontal={false}
      maxToRenderPerBatch={4}
      windowSize={8}
      removeClippedSubviews={true}
      initialNumToRender={12}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      ListEmptyComponent={emptyComponent}
      extraData={[activeIndex, playableIds]}
    />
  )
}

const styles = createStyle({
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  listItem: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingRight: 2,
    alignItems: 'center',
  },
  listItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 38,
    textAlign: 'center',
    paddingLeft: 3,
    paddingRight: 3,
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
  },
  itemMeta: {
    paddingTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemMetaText: {
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
  progressInfo: {
    width: 96,
    paddingLeft: 6,
    alignItems: 'flex-end',
  },
  iconButton: {
    height: '80%',
    paddingLeft: 12,
    paddingRight: 12,
    justifyContent: 'center',
  },
  empty: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
  },
})
