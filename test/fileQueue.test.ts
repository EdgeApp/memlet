import { expect } from 'chai'
import { describe, it } from 'mocha'

import { File } from '../src'
import { FileQueue, makeFileQueue } from '../src/fileQueue'
import { createFiles, delay } from './utils'

describe('FileQueue', () => {
  it('can queue files: files in order', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: file timestamp greater than all files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp + 1000
    }

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)
    fileQueue.enqueue(fileD)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue files: file timestamp less than end', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp - 1
    }

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)
    fileQueue.enqueue(fileD)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileD, fileC])
  })

  it('can queue files: file timestamp equal to end', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp
    }

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)
    fileQueue.enqueue(fileD)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue files: file timestamp lower than all files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)
    const fileD: File = {
      ...fileC,
      key: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp - 1000
    }

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)
    fileQueue.enqueue(fileD)

    expect(fileQueue.list()).deep.equals([fileD, fileA, fileB, fileC])
  })

  it('can queue files: lexicographically in order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    const fileQueue = makeFileQueue()

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: lexicographically in reverse order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    const fileQueue = makeFileQueue()

    fileQueue.enqueue(fileC)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileA)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: lexicographically in random order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    const fileQueue = makeFileQueue()

    ;[fileA, fileB, fileC]
      .sort(() => Math.round(Math.random()))
      .forEach(file => fileQueue.enqueue(file))

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: File with same timestamp as a multiple files in the middle of the queue', async () => {
    const firstFiles = createFiles(['X', 'Y', 'Z'], 1)
    await delay(10)
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)
    await delay(10)
    const lastFiles = createFiles(['abc', 'abc'], 1)

    let fileQueue: FileQueue

    // Assertion will be the same for all checks
    const assertion = (fileQueue: FileQueue): void => {
      expect(fileQueue.list().map(file => file.key)).deep.equals([
        ...firstFiles.map(file => file.key),
        fileA.key,
        fileB.key,
        fileC.key,
        ...lastFiles.map(file => file.key)
      ])
    }

    // Check with first of lexicographical order last
    fileQueue = makeFileQueue()
    firstFiles.forEach(file => fileQueue.enqueue(file))
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)
    lastFiles.forEach(file => fileQueue.enqueue(file))
    fileQueue.enqueue(fileA)
    assertion(fileQueue)

    // Check with middle of lexicographical order last
    fileQueue = makeFileQueue()
    firstFiles.forEach(file => fileQueue.enqueue(file))
    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileC)
    lastFiles.forEach(file => fileQueue.enqueue(file))
    fileQueue.enqueue(fileB)
    assertion(fileQueue)

    // Check with last of lexicographical order last
    fileQueue = makeFileQueue()
    firstFiles.forEach(file => fileQueue.enqueue(file))
    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    lastFiles.forEach(file => fileQueue.enqueue(file))
    fileQueue.enqueue(fileC)
    assertion(fileQueue)
  })

  it('can dequeue files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    const removedFile = fileQueue.dequeue()

    expect(fileQueue.list()).deep.equals([fileB, fileC])
    expect(removedFile).equals(fileA)
  })

  it('can requeue files at beginning', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    await delay(10)
    fileQueue.requeue(fileA)

    expect(fileQueue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    await delay(10)
    fileQueue.requeue(fileB)

    expect(fileQueue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 1)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    await delay(10)
    fileQueue.requeue(fileC)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can requeue files at beginning (lexicographically)', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    await delay(10)
    fileQueue.requeue(fileA)
    expect(fileQueue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle (lexicographically)', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    await delay(10)
    fileQueue.requeue(fileB)
    expect(fileQueue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end (lexicographically)', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], 0)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)

    await delay(10)
    fileQueue.requeue(fileC)
    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can remove files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC, fileD] = createFiles(['A', 'B', 'C', 'D'], 1)

    fileQueue.enqueue(fileA)
    fileQueue.enqueue(fileB)
    fileQueue.enqueue(fileC)
    fileQueue.enqueue(fileD)

    fileQueue.remove(fileA)

    expect(fileQueue.list()).deep.equals([fileB, fileC, fileD])

    fileQueue.remove(fileC)

    expect(fileQueue.list()).deep.equals([fileB, fileD])

    fileQueue.remove(fileD)

    expect(fileQueue.list()).deep.equals([fileB])

    fileQueue.remove(fileB)

    expect(fileQueue.list()).deep.equals([])
  })
})
