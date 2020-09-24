import { File } from '../src'

export const delay = (ms: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export const createFiles = (filenames: string[], delay: number): File[] => {
  const timestamp = Date.now()

  return filenames.map((filename, index) => ({
    filename,
    data: 'content',
    size: 123,
    lastTouchedTimestamp: timestamp + index * delay
  }))
}
