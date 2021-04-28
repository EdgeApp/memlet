import { File, MemletState } from '../src'

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export const createFiles = (keys: string[], delay: number): File[] => {
  const timestamp = Date.now()

  return keys.map((key, index) => ({
    key,
    data: 'content',
    size: 123,
    lastTouchedTimestamp: timestamp + index * delay
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
