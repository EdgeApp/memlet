import { expect } from 'chai'
import { describe, it } from 'mocha'

import { FileQueue, makeFileQueue } from '../src/file-queue'
import { File } from '../src'
import { createFiles, delay } from './utils'

describe('FileQueue', async () => {
  it('can queue files: files in order', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: file timestamp greater than all files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])
    const fileD = {
      ...fileC,
      filename: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp + 1000
    }

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)
    fileQueue.queue(fileD)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue files: file timestamp less than end', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])
    const fileD = {
      ...fileC,
      filename: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp - 1
    }

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)
    fileQueue.queue(fileD)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileD, fileC])
  })

  it('can queue files: file timestamp equal to end', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])
    const fileD = {
      ...fileC,
      filename: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp
    }

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)
    fileQueue.queue(fileD)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue files: file timestamp lower than all files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])
    const fileD = {
      ...fileC,
      filename: 'D',
      lastTouchedTimestamp: fileC.lastTouchedTimestamp - 1000
    }

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)
    fileQueue.queue(fileD)

    expect(fileQueue.list()).deep.equals([fileD, fileA, fileB, fileC])
  })

  it('can queue files: lexicographically in order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], true)

    const fileQueue = makeFileQueue()

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: lexicographically in reverse order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], true)

    const fileQueue = makeFileQueue()

    fileQueue.queue(fileC)
    fileQueue.queue(fileB)
    fileQueue.queue(fileA)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: lexicographically in random order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], true)

    const fileQueue = makeFileQueue()

    ;[fileA, fileB, fileC]
      .sort(() => Math.round(Math.random()))
      .forEach(file => fileQueue.queue(file))

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue files: File with same timestamp as a multiple files in the middle of the queue', async () => {
    const firstFiles = createFiles(['X', 'Y', 'Z'])
    await delay(10)
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], true)
    await delay(10)
    const lastFiles = createFiles(['abc', 'abc'])

    let fileQueue: FileQueue

    // Assertion will be the same for all checks
    const assertion = (fileQueue: FileQueue) =>
      expect(fileQueue.list().map(file => file.filename)).deep.equals([
        ...firstFiles.map(file => file.filename),
        fileA.filename,
        fileB.filename,
        fileC.filename,
        ...lastFiles.map(file => file.filename)
      ])

    // Check with first of lexicographical order last
    fileQueue = makeFileQueue()
    firstFiles.forEach(file => fileQueue.queue(file))
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)
    lastFiles.forEach(file => fileQueue.queue(file))
    fileQueue.queue(fileA)
    assertion(fileQueue)

    // Check with middle of lexicographical order last
    fileQueue = makeFileQueue()
    firstFiles.forEach(file => fileQueue.queue(file))
    fileQueue.queue(fileA)
    fileQueue.queue(fileC)
    lastFiles.forEach(file => fileQueue.queue(file))
    fileQueue.queue(fileB)
    assertion(fileQueue)

    // Check with last of lexicographical order last
    fileQueue = makeFileQueue()
    firstFiles.forEach(file => fileQueue.queue(file))
    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    lastFiles.forEach(file => fileQueue.queue(file))
    fileQueue.queue(fileC)
    assertion(fileQueue)
  })

  it('can dequeue files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    const removedFile = fileQueue.dequeue()

    expect(fileQueue.list()).deep.equals([fileB, fileC])
    expect(removedFile).equals(fileA)
  })

  it('can requeue files at beginning', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    await delay(10)
    fileQueue.requeue(fileA)

    expect(fileQueue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    await delay(10)
    fileQueue.requeue(fileB)

    expect(fileQueue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    await delay(10)
    fileQueue.requeue(fileC)

    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can requeue files at beginning (lexicographically)', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], true)

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    await delay(10)
    fileQueue.requeue(fileA)
    expect(fileQueue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle (lexicographically)', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], true)

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    await delay(10)
    fileQueue.requeue(fileB)
    expect(fileQueue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end (lexicographically)', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'], true)

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    await delay(10)
    fileQueue.requeue(fileC)
    expect(fileQueue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can remove files', async () => {
    const fileQueue = makeFileQueue()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    fileQueue.remove(fileB)

    expect(fileQueue.list()).deep.equals([fileA, fileC])
  })
})
