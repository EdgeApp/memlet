import { Disklet } from 'disklet'
import { Memlet, MemletStore, File } from './types'

export * from './types'

export function makeMemlet(disklet: Disklet): Memlet {
  // Private properties

  const store: MemletStore = {
    memoryUsage: 0,
    files: {}
  }

  // Private methods

  const updateStoreFile = (key: string, data: any, size: number) => {
    const lastTouchedTimestamp = Date.now()

    const extingFile = getStoreFile(key)

    const newFile: File = {
      size,
      filename: key,
      data,
      lastTouchedTimestamp
    }

    // Calculate the difference in memory useage if there is an existing file
    const memoryUsageDiff = extingFile
      ? newFile.size - extingFile.size
      : newFile.size

    // Update memoryUsage using add method
    addToMemoryUsage(memoryUsageDiff)

    // Update file in store
    store.files[key] = newFile
  }

  const getStoreFile = (key: string): File | undefined => {
    return store.files[key]
  }

  const addToMemoryUsage = (bytes: number) => {
    store.memoryUsage += bytes
  }

  return {
    // Removes an object at a given path
    delete: async (path: string) => {
      /**
       * No soft-delete: delete from memlet first then delete from disklet
       * (because disklet delete might succeed in delete, but fail on
       * something else).
       */
      delete store.files[path]
      await disklet.delete(path)
    },

    // Lists objects from a given path
    list: async (path?: string) => {
      // Direct pass-through to disklet
      return await disklet.list(path)
    },

    // Get an object at given path
    getJson: async (filename: string) => {
      const file = store.files[filename]

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
    setJson: async (filename: string, data: any) => {
      /**
       * Write-through policy: write to disklet first then put it in the cache.
       */
      const dataString = JSON.stringify(data)

      await disklet.setText(filename, dataString)

      updateStoreFile(filename, data, dataString.length)
    },

    // Introspective methods
    getStore: () => {
      return store
    }
  }
}
