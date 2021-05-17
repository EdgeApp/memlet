import { expect } from 'chai'
import { describe, it } from 'mocha'

import { File } from '../src'
import { makeQueue, Queue } from '../src/queue'
import { createFiles, delay } from './utils'

describe('Queue', () => {
  it('can queue files in order', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue file timestamp greater than all files', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp + 1000
    }

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)
    queue.enqueue(fileD)

    expect(queue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue file timestamp less than end', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp - 1
    }

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)
    queue.enqueue(fileD)

    expect(queue.list()).deep.equals([fileA, fileB, fileD, fileC])
  })

  it('can queue file timestamp equal to end', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp
    }

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)
    queue.enqueue(fileD)

    expect(queue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue file timestamp lower than all files', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp - 1000
    }

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)
    queue.enqueue(fileD)

    expect(queue.list()).deep.equals([fileD, fileA, fileB, fileC])
  })

  it('can queue lexicographically in order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    const queue = makeQueue()

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue lexicographically in reverse order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    const queue = makeQueue()

    queue.enqueue(fileC)
    queue.enqueue(fileB)
    queue.enqueue(fileA)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue lexicographically in random order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    const queue = makeQueue()

    ;[fileA, fileB, fileC]
      .sort(() => Math.round(Math.random()))
      .forEach(file => queue.enqueue(file))

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue File with same timestamp as a multiple files in the middle of the queue', async () => {
    const firstFiles = createFiles(['X', 'Y', 'Z'], 1)
    await delay(10)
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)
    await delay(10)
    const lastFiles = createFiles(['abc', 'abc'], 1)

    let queue: Queue<File>

    // Assertion will be the same for all checks
    const assertion = (queue: Queue<File>): void => {
      expect(queue.list().map(file => file.key)).deep.equals([
        ...firstFiles.map(file => file.key),
        fileA.key,
        fileB.key,
        fileC.key,
        ...lastFiles.map(file => file.key)
      ])
    }

    // Check with first of lexicographical order last
    queue = makeQueue()
    firstFiles.forEach(file => queue.enqueue(file))
    queue.enqueue(fileB)
    queue.enqueue(fileC)
    lastFiles.forEach(file => queue.enqueue(file))
    queue.enqueue(fileA)
    assertion(queue)

    // Check with middle of lexicographical order last
    queue = makeQueue()
    firstFiles.forEach(file => queue.enqueue(file))
    queue.enqueue(fileA)
    queue.enqueue(fileC)
    lastFiles.forEach(file => queue.enqueue(file))
    queue.enqueue(fileB)
    assertion(queue)

    // Check with last of lexicographical order last
    queue = makeQueue()
    firstFiles.forEach(file => queue.enqueue(file))
    queue.enqueue(fileA)
    queue.enqueue(fileB)
    lastFiles.forEach(file => queue.enqueue(file))
    queue.enqueue(fileC)
    assertion(queue)
  })

  it('can dequeue files', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    const removedFile = queue.dequeue()

    expect(queue.list()).deep.equals([fileB, fileC])
    expect(removedFile).equals(fileA)
  })

  it('can requeue files at beginning', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileA)

    expect(queue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileB)

    expect(queue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileC)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can requeue files at beginning (lexicographically)', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileA)
    expect(queue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle (lexicographically)', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileB)
    expect(queue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end (lexicographically)', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileC)
    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can remove files', async () => {
    const queue = makeQueue()

    const [fileA, fileB, fileC, fileD] = createFiles(['A', 'B', 'C', 'D'], 1)

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)
    queue.enqueue(fileD)

    queue.remove(fileA)

    expect(queue.list()).deep.equals([fileB, fileC, fileD])

    queue.remove(fileC)

    expect(queue.list()).deep.equals([fileB, fileD])

    queue.remove(fileD)

    expect(queue.list()).deep.equals([fileB])

    queue.remove(fileB)

    expect(queue.list()).deep.equals([])
  })
})
