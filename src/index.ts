import { Disklet } from 'disklet'

import { Memlet, MemletStore, File, MemletConfig } from './types'
import { makeFileQueue } from './file-queue'

export * from './types'

const defaultConfig: MemletConfig = {
  maxMemoryUsage: 0
}

export function makeMemlet(
  disklet: Disklet,
  configOptions: Partial<MemletConfig> = {}
): Memlet {
  // Private properties

  const config = { ...defaultConfig, ...configOptions }

  const store: MemletStore = {
    memoryUsage: 0,
    files: {}
  }

  const fileQueue = makeFileQueue()

  // Private methods

  const updateStoreFile = (key: string, data: any, size: number) => {
    const lastTouchedTimestamp = Date.now()

    const extingFile = store.files[key]

    const newFile: File = {
      size,
      filename: key,
      data,
      lastTouchedTimestamp
    }

    if (extingFile) {
      // Update file's position in the file queue
      fileQueue.requeue(newFile)
    } else {
      // Add file to the file queue
      fileQueue.queue(newFile)
    }

    // Calculate the difference in memory usage if there is an existing file
    const memoryUsageDiff = extingFile
      ? newFile.size - extingFile.size
      : newFile.size

    // Update memoryUsage using add method
    adjustMemoryUsage(memoryUsageDiff)

    // Update file in store
    store.files[key] = newFile
  }

  // Used to add undefined type checking to file retrieval
  const getStoreFile = (filename: string): File | undefined => {
    return store.files[filename]
  }

  const deleteStoreFile = (filename: string) => {
    const file = getStoreFile(filename)

    if (file) {
      adjustMemoryUsage(-file.size)
      delete store.files[filename]
    }
  }

  const adjustMemoryUsage = (bytes?: number) => {
    if (bytes) {
      store.memoryUsage += bytes
    }

    // Remove files if memory usage exceeds maxMemoryUsage
    if (store.memoryUsage > config.maxMemoryUsage) {
      const fileEntry = fileQueue.dequeue()
      if (fileEntry) {
        // Deleting file from store will invoke adjustMemoryUsage again
        deleteStoreFile(fileEntry.filename)
      }
    }
  }

  return {
    // Removes an object at a given path
    delete: async function (path: string) {
      /**
       * No soft-delete: delete from memlet first then delete from disklet
       * (because disklet delete might succeed in delete, but fail on
       * something else).
       */
      deleteStoreFile(path)
      await disklet.delete(path)
    },

    // Lists objects from a given path
    list: async function (path?: string) {
      // Direct pass-through to disklet
      return await disklet.list(path)
    },

    // Get an object at given path
    getJson: async function (filename: string) {
      const file = getStoreFile(filename)

      if (file) {
        // Return file found in memory store
        return file.data
      } else {
        // Retrieve file from disklet, cache it, then return
        const dataString = await disklet.getText(filename)
        const data = JSON.parse(dataString)

        updateStoreFile(filename, data, dataString.length)

        return data
      }
    },

    // Set an object at a given path
    setJson: async function (filename: string, data: any) {
      /**
       * Write-through policy: write to disklet first then put it in the cache.
       */
      const dataString = JSON.stringify(data)

      await disklet.setText(filename, dataString)

      updateStoreFile(filename, data, dataString.length)
    },

    // Introspective methods
    _getStore: function () {
      return store
    }
  }
}
