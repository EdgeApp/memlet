import { Disklet } from 'disklet'

import { Memlet, MemletStore, File, MemletConfig } from './types'
import { makeFileQueue } from './file-queue'

export * from './types'

const defaultConfig: MemletConfig = {
  maxMemoryUsage: Infinity
}

/**
 * Regex to match error message for files not found errors.
 * First, variation is from memory and localStorage memlet backends.
 * Second variation is from iOS memlet backend.
 */
const notFoundErrorMessageRegex = /^Cannot load ".+"$|^Cannot read '.+'$/

export function makeMemlet(
  disklet: Disklet,
  configOptions: Partial<MemletConfig> = {}
): Memlet {
  // Private properties

  // Divide given maxMemoryUsage config parameter to respresent char-length
  if (configOptions.maxMemoryUsage) {
    configOptions.maxMemoryUsage = configOptions.maxMemoryUsage / 2
  }

  const config = { ...defaultConfig, ...configOptions }

  const store: MemletStore = {
    memoryUsage: 0,
    files: {}
  }

  const fileQueue = makeFileQueue()

  // Private methods

  const addStoreFile = (
    filename: string,
    data: any,
    size: number,
    notFoundError?: any
  ) => {
    const file: File = {
      filename,
      data,
      size,
      lastTouchedTimestamp: Date.now(),
      notFoundError
    }

    // Add file to file queue
    fileQueue.queue(file)

    // Add file's size to memory usage
    adjustMemoryUsage(file.size)

    // Add file to the store files map
    store.files[filename] = file
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

    return file
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

  const memlet = {
    // Removes an object at a given path
    delete: async (path: string) => {
      /**
       * No soft-delete: delete from memlet first then delete from disklet
       * (because disklet delete might succeed in delete, but fail on
       * something else).
       */
      const file = deleteStoreFile(path)

      if (file) {
        fileQueue.remove(file)
      }

      await disklet.delete(path)
    },

    // Lists objects from a given path
    list: async (path?: string) => {
      // Direct pass-through to disklet
      return await disklet.list(path)
    },

    // Get an object at given path
    getJson: async (filename: string) => {
      const file = getStoreFile(filename)

      if (file) {
        // Update file in store to update it's timestamp
        file.lastTouchedTimestamp = Date.now()

        // Update file's position in the file queue
        fileQueue.requeue(file)

        // Invoke adjustMemoryUsage to potentially evict files
        adjustMemoryUsage(0)

        // If file contains a caught error, throw it.
        if (file.notFoundError) {
          throw file.notFoundError
        }

        // Return file found in memory store
        return file.data
      } else {
        try {
          // Retrieve file from disklet, store it, then return
          const dataString = await disklet.getText(filename)
          const data = JSON.parse(dataString)

          addStoreFile(filename, data, dataString.length)

          return data
        } catch (err) {
          /**
           * For file not found errors, store null data, include the error
           * object, and then then re-throw. This saves needless disklet
           * accesses on subsequent getJson invocations.
           */
          if (
            err?.message.match(notFoundErrorMessageRegex) ||
            err?.code === 'ENOENT'
          ) {
            addStoreFile(filename, null, 0, err)
          }

          // Re-throw the error from disklet
          throw err
        }
      }
    },

    // Set an object at a given path
    setJson: async (filename: string, data: any) => {
      /**
       * Write-through policy: write to disklet first then put it in the cache.
       */
      const dataString = JSON.stringify(data)

      await disklet.setText(filename, dataString)

      const file = store.files[filename]

      if (file) {
        const previousSize = file.size

        // Update all of file's fields
        file.lastTouchedTimestamp = Date.now()
        file.data = data
        file.size = JSON.stringify(data).length

        // Remove error object if present
        delete file.notFoundError

        // Update file's position in the file queue
        fileQueue.requeue(file)

        // Calculate the difference in memory usage if there is an existing file
        const sizeDiff = file.size - previousSize

        // Update memory usage with size difference
        adjustMemoryUsage(sizeDiff)
      } else {
        addStoreFile(filename, data, dataString.length)
      }
    },

    // Introspective methods
    _getStore: () => {
      return store
    }
  }

  return memlet
}
