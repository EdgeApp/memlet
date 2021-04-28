import { Disklet } from 'disklet'

import { makeFileQueue } from './file-queue'
import { File, Memlet, MemletConfig, MemletState } from './types'

export * from './types'

const defaultConfig: MemletConfig = {
  maxMemoryUsage: Infinity
}

const state: MemletState = {
  config: { ...defaultConfig },
  store: {
    memoryUsage: 0,
    files: {}
  },
  fileQueue: makeFileQueue()
}

/**
 * This is to keep a running count of memlet instances in order to determine
 * a unique ID for each instance.
 */
let countOfMemletInstances = 0

/**
 * Regex to match error message for files not found errors.
 * First, variation is from memory and localStorage memlet backends.
 * Second variation is from iOS memlet backend.
 */
const notFoundErrorMessageRegex = /^Cannot load ".+"$|^Cannot read '.+'$/

export function makeMemlet(disklet: Disklet): Memlet {
  // Private properties

  /**
   * A unique ID for the memlet instance. The ID is used as a prefix for each
   * file's key or filename in the shared file cache.
   */
  const memletInstanceId = countOfMemletInstances++

  // Private methods

  const addStoreFile = (
    path: string,
    data: any,
    size: number,
    notFoundError?: any
  ): void => {
    const filename = getCacheFilename(path)

    const file: File = {
      filename,
      data,
      size,
      lastTouchedTimestamp: Date.now(),
      notFoundError
    }

    // Add file to file queue
    state.fileQueue.queue(file)

    // Add file's size to memory usage
    adjustMemoryUsage(file.size)

    // Add file to the store files map
    state.store.files[filename] = file
  }

  // Used to add undefined type checking to file retrieval
  const getStoreFile = (filename: string): File | undefined => {
    return state.store.files[filename]
  }

  const deleteStoreFile = (filename: string): File | undefined => {
    const file = getStoreFile(filename)

    if (file != null) {
      adjustMemoryUsage(-file.size)
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete state.store.files[filename]
    }

    return file
  }

  const adjustMemoryUsage = (bytes?: number): void => {
    if (bytes != null) {
      state.store.memoryUsage += bytes
    }

    // Remove files if memory usage exceeds maxMemoryUsage
    if (state.store.memoryUsage > state.config.maxMemoryUsage) {
      const fileEntry = state.fileQueue.dequeue()
      if (fileEntry != null) {
        // Deleting file from store will invoke adjustMemoryUsage again
        deleteStoreFile(fileEntry.filename)
      }
    }
  }

  const getCacheFilename = (path: string): string => {
    return `${memletInstanceId}:${path}`
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

      if (file != null) {
        state.fileQueue.remove(file)
      }

      await disklet.delete(path)
    },

    // Lists objects from a given path
    list: async (path?: string) => {
      // Direct pass-through to disklet
      return await disklet.list(path)
    },

    // Get an object at given path
    getJson: async (path: string) => {
      const filename = getCacheFilename(path)
      const file = getStoreFile(filename)

      if (file != null) {
        // Update file in store to update it's timestamp
        file.lastTouchedTimestamp = Date.now()

        // Update file's position in the file queue
        state.fileQueue.requeue(file)

        // Invoke adjustMemoryUsage to potentially evict files
        adjustMemoryUsage(0)

        // If file contains a caught error, throw it.
        if (file.notFoundError != null) {
          throw file.notFoundError
        }

        // Return file found in memory store
        return file.data
      } else {
        try {
          // Retrieve file from disklet, store it, then return
          const dataString = await disklet.getText(path)
          const data = JSON.parse(dataString)

          addStoreFile(path, data, dataString.length)

          return data
        } catch (err) {
          /**
           * For file not found errors, store null data, include the error
           * object, and then then re-throw. This saves needless disklet
           * accesses on subsequent getJson invocations.
           */
          if (
            notFoundErrorMessageRegex.test(err?.message) ||
            err?.code === 'ENOENT'
          ) {
            addStoreFile(path, null, 0, err)
          }

          // Re-throw the error from disklet
          throw err
        }
      }
    },

    // Set an object at a given path
    setJson: async (path: string, data: any) => {
      /**
       * Write-through policy: write to disklet first then put it in the cache.
       */
      const dataString = JSON.stringify(data)

      await disklet.setText(path, dataString)

      const filename = getCacheFilename(path)
      const file = getStoreFile(filename)

      if (file != null) {
        const previousSize = file.size

        // Update all of file's fields
        file.lastTouchedTimestamp = Date.now()
        file.data = data
        file.size = JSON.stringify(data).length

        // Remove error object if present
        delete file.notFoundError

        // Update file's position in the file queue
        state.fileQueue.requeue(file)

        // Calculate the difference in memory usage if there is an existing file
        const sizeDiff = file.size - previousSize

        // Update memory usage with size difference
        adjustMemoryUsage(sizeDiff)
      } else {
        addStoreFile(path, data, dataString.length)
      }
    }
  }

  return memlet
}

// Update's module's config
export function setMemletConfig(config: Partial<MemletConfig>): void {
  // Divide given maxMemoryUsage config parameter to respresent char-length
  if (config.maxMemoryUsage != null) {
    config.maxMemoryUsage = config.maxMemoryUsage / 2
  }

  // Update state's config
  state.config = { ...state.config, ...config }
}

// Clears the file cache fields in the module's state
export function clearMemletCache(): void {
  state.store.memoryUsage = 0
  state.store.files = {}
  state.fileQueue = makeFileQueue()
}

// Resets config and clears file cache
export function resetMemletState(): void {
  state.config = { ...defaultConfig }
  clearMemletCache()
}

// Internal Methods:

// Get the module's state object
export function _getMemletState(): Readonly<MemletState> {
  return state
}
