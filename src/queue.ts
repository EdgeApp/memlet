export function makeQueue<T extends QueueItem>(): Queue<T> {
  const items: T[] = []

  const itemQueue: Queue<T> = {
    /**
     * Inserts a item to the end of the queue with guaranteed ordering.
     * items are ordered by lastTouchedTimestamp and then lexigraphical order
     * on key.
     * @param item The item to insert into queue.
     */
    enqueue: (item: T) => {
      let endItemIndex = items.length - 1

      for (; endItemIndex >= 0; --endItemIndex) {
        const endItem = items[endItemIndex]

        if (
          item.lastTouchedTimestamp > endItem.lastTouchedTimestamp ||
          (item.lastTouchedTimestamp === endItem.lastTouchedTimestamp &&
            item.key > endItem.key)
        ) {
          break
        }
      }

      items.splice(endItemIndex + 1, 0, item)
    },
    dequeue: () => {
      return items.shift()
    },
    requeue: (item: T) => {
      itemQueue.remove(item)
      item.lastTouchedTimestamp = Date.now()
      itemQueue.enqueue(item)
    },
    remove: (item: T) => {
      const index = indexOfItemInQueue(items, item)

      if (index >= 0) {
        items.splice(index, 1)
      }
    },
    list: () => {
      return items
    }
  }

  return itemQueue
}

/**
 * Uses binary search to find the index of a given item in a given itemQueue.
 *
 * @param items Array of sorted Item objects
 * @param item The Item object for which to search.
 */
function indexOfItemInQueue(items: QueueItem[], item: QueueItem): number {
  let l = 0
  let r = items.length - 1

  while (l <= r) {
    // Use bit shift over division to avoid floats
    const index = (l + r) >> 1

    // Item in queue to compare
    const itemInQueue = items[index]

    // Direction to continue binary search. Zero is a match.
    // Negative is to search lower and positive is to search higher.
    const direction =
      item === itemInQueue
        ? 0
        : // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          item.lastTouchedTimestamp - itemInQueue.lastTouchedTimestamp ||
          // Fallback to lexigraphical comparison (if timestamps match)
          (item.key > itemInQueue.key ? 1 : -1)

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

  // Return -1 when item cannot be found.
  return -1
}

export interface Queue<T> {
  enqueue: (item: T) => void
  dequeue: () => T | undefined
  requeue: (item: T) => void
  remove: (item: T) => void
  list: () => T[]
}

export interface QueueItem {
  lastTouchedTimestamp: number
  key: string
}
