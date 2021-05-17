import { expect } from 'chai'
import { describe, it } from 'mocha'

import { File } from '../src'
import { makeQueue, Queue } from '../src/queue'
import { createFiles, delay } from './utils'

describe('Queue', () => {
  it('can queue files in order', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue file timestamp greater than all files', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC, fileD] = createFiles(['A', 'B', 'C', 'D'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    const timestampRef = Date.now()
    queue.enqueue(fileC)

    queue.enqueue(fileD, timestampRef + 100)

    expect(queue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue file timestamp less than end', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC, fileD] = createFiles(['A', 'B', 'C', 'D'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    const timestampRef = Date.now()
    queue.enqueue(fileC)

    queue.enqueue(fileD, timestampRef - 1)

    expect(queue.list().map(file => file.key)).deep.equals(['A', 'B', 'D', 'C'])
  })

  it('can queue file timestamp equal to end', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC, fileD] = createFiles(['A', 'B', 'C', 'D'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)
    queue.enqueue(fileD)

    expect(queue.list()).deep.equals([fileA, fileB, fileC, fileD])
  })

  it('can queue file timestamp lower than all files', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC, fileD] = createFiles(['A', 'B', 'C', 'D'])

    const timestampRef = Date.now()

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)

    queue.enqueue(fileD, timestampRef - 1000)

    expect(queue.list().map(file => file.key)).deep.equals(['D', 'A', 'B', 'C'])
  })

  it('can queue lexicographically in order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    const queue = makeQueue<File>()

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue lexicographically in reverse order', async () => {
    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    const queue = makeQueue<File>()

    queue.enqueue(fileC)
    queue.enqueue(fileB)
    queue.enqueue(fileA)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can queue lexicographically in random order', async () => {
    const files = createFiles(['A', 'B', 'C'])

    const queue = makeQueue<File>()

    files
      .sort(() => Math.round(Math.random()))
      .forEach(file => queue.enqueue(file))

    expect(queue.list()).deep.equals(files)
  })

  it('can queue File with same timestamp as a multiple files in the middle of the queue', async () => {
    const firstFiles = createFiles(['X', 'Y', 'Z'])
    const middleFiles = createFiles(['A', 'B', 'C'])
    const lastFiles = createFiles(['abc', 'abc'])

    // Assertion will be the same for all checks
    const assertion = (queue: Queue<File>): void => {
      expect(queue.list().map(file => file.key)).deep.equals(
        [...firstFiles, ...middleFiles, ...lastFiles].map(file => file.key)
      )
    }

    const queue = makeQueue<File>()

    // First files
    for (const file of firstFiles) {
      await delay(1)
      queue.enqueue(file)
    }

    await delay(10)

    // Middle files
    const timestampRef = Date.now()
    for (let i = 0; i < middleFiles.length; ++i) {
      const file = middleFiles[i]
      queue.enqueue(file, timestampRef + i)
    }

    await delay(10)

    // Last files
    for (const file of lastFiles) {
      await delay(1)
      queue.enqueue(file)
    }

    // Check with first of lexicographical order last
    queue.requeue(middleFiles[0], timestampRef)
    assertion(queue)

    // Check with middle of lexicographical order last
    queue.requeue(middleFiles[1], timestampRef + 1)
    assertion(queue)

    // Check with last of lexicographical order last
    queue.requeue(middleFiles[2], timestampRef + 2)
    assertion(queue)
  })

  it('can dequeue files', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)
    await delay(1)

    const removedFile = queue.dequeue()

    expect(queue.list()).deep.equals([fileB, fileC])
    expect(removedFile).equals(fileA)
  })

  it('can requeue files at beginning', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileA)

    expect(queue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileB)

    expect(queue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileC)

    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can requeue files at beginning (lexicographically)', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileA)
    expect(queue.list()).deep.equals([fileB, fileC, fileA])
  })

  it('can requeue files at middle (lexicographically)', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileB)
    expect(queue.list()).deep.equals([fileA, fileC, fileB])
  })

  it('can requeue files at end (lexicographically)', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC] = createFiles(['A', 'B', 'C'])

    queue.enqueue(fileA)
    queue.enqueue(fileB)
    queue.enqueue(fileC)

    await delay(10)
    queue.requeue(fileC)
    expect(queue.list()).deep.equals([fileA, fileB, fileC])
  })

  it('can remove files', async () => {
    const queue = makeQueue<File>()

    const [fileA, fileB, fileC, fileD] = createFiles(['A', 'B', 'C', 'D'])

    queue.enqueue(fileA)
    await delay(1)
    queue.enqueue(fileB)
    await delay(1)
    queue.enqueue(fileC)
    await delay(1)
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
