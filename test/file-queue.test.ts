import { expect } from 'chai'
import { describe, it } from 'mocha'

import { makeFileQueue } from '../src/file-queue'
import { File } from '../src'
import { delay } from './utils'

describe('FileQueue', async () => {
  const fileA: File = {
    filename: 'file-A',
    data: 'content',
    size: 123,
    lastTouchedTimestamp: Date.now()
  }
  const fileB: File = {
    filename: 'file-B',
    data: 'content',
    size: 123,
    lastTouchedTimestamp: Date.now() + 1
  }
  const fileC: File = {
    filename: 'file-C',
    data: 'content',
    size: 123,
    lastTouchedTimestamp: Date.now() + 2
  }

  it('can queue files', async () => {
    const fileQueue = makeFileQueue()

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    const filenames = fileQueue.list().map(fileEntry => fileEntry.filename)

    expect(filenames).deep.equals(['file-A', 'file-B', 'file-C'])
  })

  it('can dequeue files', async () => {
    const fileQueue = makeFileQueue()

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    const removedFile = fileQueue.dequeue()

    const filenames = fileQueue.list().map(fileEntry => fileEntry.filename)

    expect(filenames).deep.equals(['file-B', 'file-C'])
    expect(removedFile?.filename).equals('file-A')
  })

  it('can requeue files', async () => {
    const fileQueue = makeFileQueue()

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    await delay(10)

    fileQueue.requeue(fileA)

    const filenames = fileQueue.list().map(fileEntry => fileEntry.filename)

    expect(filenames).deep.equals(['file-B', 'file-C', 'file-A'])
  })

  it('can remove files', async () => {
    const fileQueue = makeFileQueue()

    fileQueue.queue(fileA)
    fileQueue.queue(fileB)
    fileQueue.queue(fileC)

    fileQueue.remove(fileB)

    const filenames = fileQueue.list().map(fileEntry => fileEntry.filename)

    expect(filenames).deep.equals(['file-A', 'file-C'])
  })
})