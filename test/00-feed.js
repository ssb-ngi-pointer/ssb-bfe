// SPDX-FileCopyrightText: 2021 Anders Rune Jensen
//
// SPDX-License-Identifier: Unlicense

const tape = require('tape')
const bfe = require('../')

const { bfeNamedTypes, bfeTypes } = bfe

tape('00 feed type', function (t) {
  const values = [
    '@FY5OG311W4j/KPh8H9B2MZt4WSziy/p+ABkKERJdujQ=.ed25519', // classic
    'ssb:feed/classic/FY5OG311W4j_KPh8H9B2MZt4WSziy_p-ABkKERJdujQ=', // classic URI form
    'ssb:feed/ed25519/FY5OG311W4j_KPh8H9B2MZt4WSziy_p-ABkKERJdujQ=', // classic URI form (deprecated)
    'ssb:feed/gabbygrove-v1/FY5OG311W4j_KPh8H9B2MZt4WSziy_p-ABkKERJdujQ=', // gabby-grove
    // bamboo
    'ssb:feed/bendybutt-v1/6CAxOI3f-LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4-Uv0=', // bendy-butt
    'ssb:feed/buttwoo-v1/FY5OG311W4j_KPh8H9B2MZt4WSziy_p-ABkKERJdujQ=', // butt2
    'ssb:feed/indexed-v1/FY5OG311W4j_KPh8H9B2MZt4WSziy_p-ABkKERJdujQ=', // indexed-v1
  ]

  const encoded = bfe.encode(values)

  t.deepEquals(
    encoded[0].slice(0, 2),
    Buffer.from([0, 0]),
    'classic feed (sigil)'
  )
  t.deepEquals(
    encoded[1].slice(0, 2),
    Buffer.from([0, 0]),
    'classic feed (uri)'
  )
  t.deepEquals(
    encoded[2].slice(0, 2),
    Buffer.from([0, 0]),
    'classic feed (uri, deprecated)'
  )
  t.deepEquals(encoded[3].slice(0, 2), Buffer.from([0, 1]), 'gabby grove feed')
  t.deepEquals(encoded[4].slice(0, 2), Buffer.from([0, 3]), 'bendy feed')
  t.deepEquals(encoded[5].slice(0, 2), Buffer.from([0, 4]), 'buttwoo feed')
  t.deepEquals(encoded[6].slice(0, 2), Buffer.from([0, 5]), 'index feed')

  const expectedDecodedValues = values
  expectedDecodedValues[1] = values[0] // "classic" format decodes => sigil form
  expectedDecodedValues[2] = values[0] // "classic" format decodes => sigil form
  t.deepEquals(bfe.decode(encoded), values, 'decode works')

  t.deepEquals(
    bfe.decodeTypeFormat(encoded[0], 'feed', 'classic'),
    values[0],
    'decode classic works'
  )
  t.deepEquals(
    bfe.decodeTypeFormat(encoded[4], 'feed', 'bendybutt-v1'),
    values[4],
    'decode bendy butt works'
  )

  /* unhappy paths */
  const unknownFeedId = '@' + Buffer.from('dog').toString('base64') + '.dog255'
  t.throws(
    () => {
      bfe.encode(unknownFeedId)
    },
    { message: 'No encoder for type=feed format=? for string @ZG9n.dog255' },
    'unknown feedId encode throws (.dog225)'
  )

  // sigil-based refs are not recognised for gabby grove feeds (must be in uri format)
  const gabbyFeedId = '@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ggfeed-v1'
  t.throws(
    () => {
      bfe.encode(gabbyFeedId)
    },
    {
      message:
        'No encoder for type=feed format=? for string @6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ggfeed-v1',
    },
    'unknown feedId encode throws (.ggfeed-v1)'
  )

  t.throws(
    () => bfe.decode(Buffer.from([0, 200, 21])), // type 200 DNE
    'unknown feed type decode throws'
  )

  /* MISC function */
  const FEED = bfeNamedTypes['feed'] // eslint-disable-line
  t.equal(FEED.formats['classic'].data_length, 32, '32 bytes')

  const classicKeyLength = bfeTypes[0].formats[0].data_length
  t.equal(classicKeyLength, 32, '32 bytes')
  t.end()
})
