import { DiskletListing } from 'disklet'

import { _getMemletState, File, MemletState } from '../src'
import { folderizePath, normalizePath } from '../src/helpers/paths'

export const createFiles = (keys: string[]): File[] => {
  return keys.map(key => ({
    key,
    data: 'content',
    size: 123
  }))
}

export const measureDataSize = (data: any): number =>
  JSON.stringify(data).length * 2

export const measureMaxMemoryUsage = (maxMemoryUsage: number): number =>
  maxMemoryUsage * 2

export const getNormalizeStoreFilenames = (state: MemletState): string[] => {
  const keys = Object.keys(state.store.files)
  return keys.map(key => key.replace(/^\d+:/, ''))
}

export const listCacheOnly = (
  memletInstanceId: number,
  path: string = ''
): DiskletListing => {
  const state = _getMemletState()
  const filePathToKey = (path: string): string => `${memletInstanceId}:${path}`
  const filepath = normalizePath(path)
  const key = filePathToKey(filepath)
  const out: DiskletListing = {}

  // Try the path as a file:
  if (state.store.files[key] != null) out[filepath] = 'file'

  // Try the path as a folder:
  const folderKey = filePathToKey(folderizePath(filepath))
  for (const key of Object.keys(state.store.files)) {
    // Skip if file is not in folder search path
    if (key.indexOf(folderKey) !== 0) continue

    const pathOfKey = key.split(':')[1]
    const slashIndex = pathOfKey.indexOf('/', folderKey.length)
    if (slashIndex < 0) out[pathOfKey] = 'file'
    else out[pathOfKey.slice(0, slashIndex)] = 'folder'
  }

  return out
}
