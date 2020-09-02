import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { makeMemlet, Memlet } from '../src/index'

export async function createObjects(memlet: Memlet) {
  const file = { content: 'file content' }
  const folder = { content: 'folder content' }
  const subfolder = { content: 'subfolder content' }

  memlet.setJSON('file', file)
  memlet.setJSON('folder', folder)
  memlet.setJSON('folder/sub', subfolder)

  return { file, folder, subfolder }
}

describe('memlet', async () => {
  const disklet = makeMemoryDisklet()
  const memlet = makeMemlet(disklet)

  const { file, folder, subfolder } = await createObjects(memlet)

  it('can list top items', async () => {
    expect(await memlet.list()).deep.equals({
      file: 'file',
      folder: 'folder'
    })
  })

  it('can list sub items', async () => {
    expect(await memlet.list('folder')).deep.equals({
      folder: 'file',
      'folder/sub': 'file'
    })

    expect(await memlet.list('folder/sub')).deep.equals({
      'folder/sub': 'file'
    })
  })

  it('can retrieve item', async () => {
    expect(await memlet.getJSON('file')).deep.equals(file)
    expect(await memlet.getJSON('folder')).deep.equals(folder)
    expect(await memlet.getJSON('folder/sub')).deep.equals(subfolder)
  })
})
