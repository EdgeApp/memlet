import { File } from './types'

export function makeFileQueue() {
  const fileQueue: File[] = []

  return {
    /**
     * Inserts a file to the end of the queue with guaranteed ordering.
     * Files are ordered by lastTouchedTimestamp and then lexigraphical order
     * on filename.
     * @param file The file to insert into queue.
     */
    queue: function (file: File) {
      let endFileIndex = fileQueue.length - 1
      let endFile = fileQueue[endFileIndex]

      while (
        endFileIndex > 0 &&
        file.lastTouchedTimestamp <= endFile.lastTouchedTimestamp &&
        file.filename < endFile.filename
      ) {
        endFile = fileQueue[--endFileIndex]
      }

      fileQueue.splice(endFileIndex + 1, 0, file)
    },
    dequeue: function () {
      return fileQueue.shift()
    },
    requeue: function (file: File) {
      this.remove(file)
      file.lastTouchedTimestamp = Date.now()
      this.queue(file)
    },
    remove: function (file: File) {
      const index = indexOfFileInQueue(fileQueue, file)

      if (index >= 0) {
        fileQueue.splice(index, 1)
      }
    },
    list: function () {
      return fileQueue
    }
  }
}

/**
 * Uses binary search to find the index of a given file in a given fileQueue.
 *
 * @param fileQueue Array of File objects sorted by lastTouchTimestamp
 * @param file The File object for which to search.
 */
function indexOfFileInQueue(fileQueue: File[], file: File) {
  let l = 0
  let r = fileQueue.length - 1

  while (l <= r) {
    // Use bit shift over division to avoid floats
    let index = (l + r) >> 1

    // File in queue to compare
    const fileInQueue = fileQueue[index]

    // Direction to continue binary search. Zero is a match.
    // Negative is to search lower and positive is to search higher.
    const direction =
      file === fileInQueue
        ? 0
        : file.lastTouchedTimestamp - fileInQueue.lastTouchedTimestamp ||
          // Fallback to lexigraphical comparison (if timestamps match)
          // TODO: This solution requires that lexigraphical comparison is
          // used on insert (queue method).
          (file.filename > fileInQueue.filename ? 1 : -1)

    if (direction > 0) {
      // To search higher, increase left
      l = index + 1
    } else if (direction < 0) {
      // To search lower, decrease right
      r = index - 1
    } else {
      // If found return index
      return index
    }
  }

  // Return -1 when file cannot be found.
  return -1
}
