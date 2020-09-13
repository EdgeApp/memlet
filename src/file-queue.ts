import { File } from './types'

export function makeFileQueue() {
  const filesOrderedByDate: FileQueue = []

  return {
    queue: function (file: File) {
      filesOrderedByDate.push(file)
    },
    dequeue: function () {
      return filesOrderedByDate.shift()
    },
    requeue: function (file: File) {
      this.remove(file)
      this.queue(file)
    },
    remove: function (file: File) {
      const index = indexOfFileInQueue(filesOrderedByDate, file)

      if (index >= 0) {
        filesOrderedByDate.splice(index, 1)
      }
    },
    list: function () {
      return filesOrderedByDate
    }
  }
}

function indexOfFileInQueue(fileQueue: FileQueue, file: File) {
  return binarySearch(fileQueue, fileInQueue => {
    return file === fileInQueue
      ? 0
      : file.lastTouchedTimestamp - fileInQueue.lastTouchedTimestamp ||
          // Fallback to lexigraphical comparison (if timestamps match)
          (file.filename > fileInQueue.filename ? 1 : -1)
  })
}

function binarySearch<T>(ar: T[], compareFn: (el: T) => number) {
  var m = 0
  var n = ar.length - 1
  while (m <= n) {
    var k = (n + m) >> 1
    var cmp = compareFn(ar[k])
    if (cmp > 0) {
      m = k + 1
    } else if (cmp < 0) {
      n = k - 1
    } else {
      return k
    }
  }
  return -m - 1
}

export type FileQueue = File[]
