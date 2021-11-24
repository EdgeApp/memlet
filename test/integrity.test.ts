import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { makeMemlet, notFoundErrorMessageRegex } from '../src'

describe('Error optimizations', () => {
  it('cannot interfere with list', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    expect(await memlet.list()).deep.equals({})

    await expect(memlet.getJson('unavailable')).to.rejectedWith(
      notFoundErrorMessageRegex
    )

    expect(await memlet.list()).deep.equals({})
  })
})

describe('Memlet isolation', () => {
  it('wont list files from another memlet', async () => {
    const disklet = makeMemoryDisklet()
    const memlet1 = makeMemlet(disklet)
    const memlet2 = makeMemlet(disklet)

    await memlet1.setJson('asldjf', 'file')
    await memlet2.setJson('bsldjf', 'file')

    const [memlet1List, memlet2List] = await Promise.all([
      memlet1.list(),
      memlet2.list()
    ])

    expect(memlet1List).deep.equals({ asldjf: 'file' })
    expect(memlet2List).deep.equals({ bsldjf: 'file' })
  })
})
