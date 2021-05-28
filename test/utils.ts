import { File, MemletState } from '../src'

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
