// Following the TFD spec (also known as TFK), the naming convention in this
// file uses "T" to mean "Type byte", "TF" to mean "Type byte and Format byte"
// and "D" to mean "Data bytes".

const TYPES = require('./bfe.json')

const BUFFED_TYPES = TYPES.map((type) => {
  return {
    ...type,
    code: Buffer.from([type.code]),
    formats: type.formats.map((format) => {
      return {
        ...format,
        code: Buffer.from([format.code]),
        TFCode: Buffer.from([type.code, format.code]),
        suffixChecks: getSuffixChecks(format.suffix),
      }
    }),
  }
})

function getSuffixChecks(suffix) {
  if (!suffix) return

  const result = []
  for (let type of TYPES) {
    for (let format of type.formats) {
      if (format.suffix) {
      }
      if (
        format.suffix &&
        format.suffix.endsWith(suffix) &&
        format.suffix !== suffix
      ) {
        result.push(format.suffix)
      }
    }
  }

  return result.length ? result : undefined
}

// WIP SUFFIX_ONLY_TFS
// SIGILLED_TFS

function convertTypesToNamedTypes(TYPES) {
  const NAMED_TYPES = {}

  function convertFormats(type) {
    const formats = {}
    for (let i = 0; i < type.formats.length; ++i) {
      const format = type.formats[i]
      formats[format.format] = format
    }

    return { ...type, formats }
  }

  for (let i = 0; i < TYPES.length; ++i) {
    const type = TYPES[i]
    NAMED_TYPES[type.type] = convertFormats(type)
  }

  return NAMED_TYPES
}

const NAMED_TYPES = convertTypesToNamedTypes(TYPES)

const FEED = NAMED_TYPES['feed']
const FEED_T = Buffer.from([FEED.code])
const CLASSIC_FEED_TF = Buffer.from([
  FEED.code,
  FEED.formats['ssb/classic'].code,
])
const GABBYGR_FEED_TF = Buffer.from([
  FEED.code,
  FEED.formats['ssb/gabby-grove'].code,
])
const BENDYBT_FEED_TF = Buffer.from([
  FEED.code,
  FEED.formats['ssb/bendy-butt'].code,
])

const MSG = NAMED_TYPES['msg']
const MSG_T = Buffer.from([MSG.code])
const CLASSIC_MSG_TF = Buffer.from([MSG.code, MSG.formats['ssb/classic'].code])
const GABBYGR_MSG_TF = Buffer.from([
  MSG.code,
  MSG.formats['ssb/gabby-grove'].code,
])
const BENDYBT_MSG_TF = Buffer.from([
  MSG.code,
  MSG.formats['ssb/bendy-butt'].code,
])

const BLOB = NAMED_TYPES['blob']
const BLOB_T = Buffer.from([BLOB.code])
const CLASSIC_BLOB_TF = Buffer.from([
  BLOB.code,
  BLOB.formats['ssb/classic'].code,
])

const SIGNATURE = NAMED_TYPES['signature']
const SIGNATURE_TF = Buffer.from([
  SIGNATURE.code,
  SIGNATURE.formats['ed25519'].code,
])

const BOX = NAMED_TYPES['encrypted']
const BOX_T = Buffer.from([BOX.code])
const BOX1_TF = Buffer.from([BOX.code, BOX.formats['box1'].code])
const BOX2_TF = Buffer.from([BOX.code, BOX.formats['box2'].code])

const DH = NAMED_TYPES['diffie-hellman']
const DH_TF = Buffer.from([DH.code, DH.formats['curve25519'].code])

const GENERIC = NAMED_TYPES['generic']
const STRING_TF = Buffer.from([
  GENERIC.code,
  GENERIC.formats['UTF8 string'].code,
])
const BOOL_TF = Buffer.from([GENERIC.code, GENERIC.formats['boolean'].code])
const BOOL_TRUE = Buffer.from([1])
const BOOL_FALSE = Buffer.from([0])
const NIL_TF = Buffer.from([GENERIC.code, GENERIC.formats['nil'].code])
const NIL_TFD = NIL_TF

const encoder = {
  feed(feedId) {
    let tf
    if (feedId.endsWith('.ed25519')) tf = CLASSIC_FEED_TF
    else if (feedId.endsWith('.ggfeed-v1')) tf = GABBYGR_FEED_TF
    else if (feedId.endsWith('.bbfeed-v1')) tf = BENDYBT_FEED_TF
    else throw new Error('Unknown feed format: ' + feedId)

    const dotIndex = feedId.lastIndexOf('.')
    const b64part = feedId.substring(1, dotIndex)
    const d = Buffer.from(b64part, 'base64')

    return Buffer.concat([tf, d])
  },

  message(msgId) {
    let tf
    if (msgId.endsWith('.sha256')) tf = CLASSIC_MSG_TF
    else if (msgId.endsWith('.ggmsg-v1')) tf = GABBYGR_MSG_TF
    else if (msgId.endsWith('.bbmsg-v1')) tf = BENDYBT_MSG_TF
    else throw new Error('Unknown msg ID: ' + msgId)

    const dotIndex = msgId.lastIndexOf('.')
    const b64part = msgId.substring(1, dotIndex)
    const d = Buffer.from(b64part, 'base64')

    return Buffer.concat([tf, d])
  },

  blob(blobId) {
    let tf
    if (blobId.endsWith('.sha256')) tf = CLASSIC_BLOB_TF
    else throw new Error('Unknown blob ID: ' + blobId)

    const dotIndex = blobId.lastIndexOf('.')
    const b64part = blobId.substring(1, dotIndex)
    const d = Buffer.from(b64part, 'base64')

    return Buffer.concat([tf, d])
  },

  box(boxedStr) {
    if (boxedStr.endsWith('.box')) {
      const b64part = boxedStr.substring(0, boxedStr.length - '.box'.length)
      const d = Buffer.from(b64part, 'base64')
      return Buffer.concat([BOX1_TF, d])
    } else if (boxedStr.endsWith('.box2')) {
      const b64part = boxedStr.substring(0, boxedStr.length - '.box2'.length)
      const d = Buffer.from(b64part, 'base64')
      return Buffer.concat([BOX2_TF, d])
    } else throw new Error('Unknown boxed string: ' + boxedStr)
  },

  signature(sig) {
    const b64part = sig.substring(0, sig.length - '.sig.ed25519'.length)
    const d = Buffer.from(b64part, 'base64')
    return Buffer.concat([SIGNATURE_TF, d])
  },

  string(str) {
    const d = Buffer.from(str, 'utf8')
    return Buffer.concat([STRING_TF, d])
  },

  boolean(bool) {
    const d = bool ? BOOL_TRUE : BOOL_FALSE
    return Buffer.concat([BOOL_TF, d])
  },
}

function findTypeFormat(input) {
  // Look for type based on sigil
  // NOTE tests guarentee that sigil is unique across types
  let type = BUFFED_TYPES.find(
    (type) => type.sigil && input.startsWith(type.sigil)
  )
  let format

  // Look for type, format based on suffix
  // NOTE tests guarentee suffixes are unique for all type-formats
  if (!type) {
    for (let type of BUFFED_TYPES) {
      for (let format of type.formats) {
        if (isInputSuffixMatch(input, format)) {
          return { type, format }
        }
      }
    }
  }

  if (type && !format) {
    format = type.formats.find(
      (format) => format.suffix && input.endsWith(format.suffix)
    )
  }

  return { type, format }
}

function isInputSuffixMatch(input, format) {
  if (format.suffix && input.endsWith(format.suffix))
    console.log('format match?', format)
  return (
    format.suffix &&
    input.endsWith(format.suffix) &&
    !(
      // check we've not matched with part of a longer cousin suffix
      // e.g. .ed25519 in .sig.ed25519
      (
        format.suffixChecks &&
        format.suffixChecks.some((s) => input.endsWith(s))
      )
    )
  )
}

function encode(input) {
  /* cases we don't encode */
  if (input === undefined || Buffer.isBuffer(input) || Number.isInteger(input))
    return input

  if (typeof input === 'string') {
    /* ssb-URI */
    if (input.startsWith('ssb://')) {
      let [type, format, ...data] = input.slice(6).split('/')
      // *FIRE* WARNING ... are we URIEncoding our URIs?!
      type = NAMED_TYPES[type]
      if (type) {
        format = type.formats[format]
        if (format) {
          return Buffer.concat([
            Buffer.from([type.code]),
            Buffer.from([format.code]),
            Buffer.from(data.join('/'), 'base64'),
          ])
        }
      }
    }

    /* classic links (sigil and/or suffix matches */
    const { type, format } = findTypeFormat(input)
    if (type && format) {
      let data = input
      if (type.sigil) data = data.slice(1)
      if (format.suffix) data = data.replace(format.suffix, '')

      return Buffer.concat([
        type.code,
        format.code,
        Buffer.from(data, 'base64'),
      ])
    }

    /* fallback to (type: generic, format: UTF8) */
    return Buffer.concat([Buffer.from([6, 0]), Buffer.from(input, 'utf8')])
  }
  if (typeof input === 'boolean') return encoder.boolean(input)
  if (input === null) return NIL_TFD

  /* recursions */
  if (Array.isArray(input)) {
    return input.map((x) => {
      const y = encode(x)
      if (y === undefined) return NIL_TFD
      else return y
    })
  }
  if (typeof input === 'object') {
    // we know it's not: Buffer,null,Array
    const output = {}
    for (let key in input) {
      const y = encode(input[key])
      if (y !== undefined) output[key] = y
    }
    return output
  }

  throw new Error('cannot encoding, type is not defined')
}

const decoder = {
  feed(buf) {
    const tf = buf.slice(0, 2)
    const d = buf.slice(2)

    let feedExtension
    if (tf.equals(CLASSIC_FEED_TF)) feedExtension = '.ed25519'
    else if (tf.equals(GABBYGR_FEED_TF)) feedExtension = '.ggfeed-v1'
    else if (tf.equals(BENDYBT_FEED_TF)) feedExtension = '.bbfeed-v1'
    else throw new Error('Unknown feed: ' + buf)

    const b64part = d.toString('base64')
    return '@' + b64part + feedExtension
  },

  message(buf) {
    const tf = buf.slice(0, 2)
    const d = buf.slice(2)

    let msgExtension
    if (tf.equals(CLASSIC_MSG_TF)) msgExtension = '.sha256'
    else if (tf.equals(GABBYGR_MSG_TF)) msgExtension = '.ggmsg-v1'
    else if (tf.equals(BENDYBT_MSG_TF)) msgExtension = '.bbmsg-v1'
    else throw new Error('Unknown msg: ' + buf)

    const b64part = d.toString('base64')
    return '%' + b64part + msgExtension
  },

  blob(buf) {
    const tf = buf.slice(0, 2)
    const d = buf.slice(2)

    let blobExtension
    if (tf.equals(CLASSIC_BLOB_TF)) blobExtension = '.sha256'
    else throw new Error('Unknown blob ID: ' + buf)

    const b64part = d.toString('base64')
    return '&' + b64part + blobExtension
  },

  signature(buf) {
    const d = buf.slice(2)
    const b64part = d.toString('base64')
    return b64part + '.sig.ed25519'
  },

  box(buf) {
    const tf = buf.slice(0, 2)
    const d = buf.slice(2)
    if (tf.equals(BOX1_TF)) return d.toString('base64') + '.box'
    else if (tf.equals(BOX2_TF)) return d.toString('base64') + '.box2'
    else throw new Error('Unknown box: ' + buf)
  },

  string(buf) {
    const d = buf.slice(2)
    return d.toString('utf8')
  },

  boolean(buf) {
    const d = buf.slice(2)
    return d.equals(BOOL_TRUE)
  },
}

function decode(input) {
  /* cases we don't decode */
  if (input === null) return null
  if (Number.isInteger(input)) return input

  if (Buffer.isBuffer(input)) {
    if (input.length < 2)
      throw new Error('Buffer is missing first two type & format bytes')
    const t = input.slice(0, 1)
    const type = BUFFED_TYPES.find((type) => t.equals(type.code))

    // const tf = input.slice(0, 2)
    if (type) {
      const f = input.slice(1, 2)
      const format = type.formats.find((format) => f.equals(format.code))
      if (format) {
        // classic
        if (type.sigil || format.suffix) {
          return [
            type.sigil || '',
            input.slice(2).toString('base64'),
            format.suffix || '',
          ].join('')
        } else if (format.TFCode.equals(STRING_TF))
          return input.slice(2).toString('utf8')
        else if (format.TFCode.equals(NIL_TF)) return null
        else if (format.TFCode.equals(BOOL_TF)) {
          if (input.size > 3) throw new Error('boolean BFE must be 3 bytes')
          if (input.slice(2, 3).equals(BOOL_FALSE)) return false
          if (input.slice(2, 3).equals(BOOL_TRUE)) return true

          throw new Error('invalid boolean BFE')
        } else {
          return [
            'ssb:/',
            type.type,
            format.format,
            input.slice(2).toString('base64'),
          ].join('/')
        }
      }
    } else throw new Error('unknown type')

    // if (tf.equals(STRING_TF)) return decoder.string(input)
    // else if (tf.equals(BOOL_TF)) return decoder.boolean(input)
    // else if (tf.equals(NIL_TF)) return null
    // else if (t.equals(FEED_T)) return decoder.feed(input)
    // else if (t.equals(MSG_T)) return decoder.message(input)
    // else if (t.equals(BLOB_T)) return decoder.blob(input)
    // else if (t.equals(BOX_T)) return decoder.box(input)
    // else if (tf.equals(SIGNATURE_TF)) return decoder.signature(input)
  }

  /* recurse */
  if (Array.isArray(input)) return input.map(decode)
  if (typeof input === 'object') {
    // know it's not null, Array
    const output = {}
    for (let key in input) {
      output[key] = decode(input[key])
    }
    return output
  }

  // FIXME: more checks, including floats!
  throw new Error("don't know how to decode: " + input)
}

module.exports = {
  encode,
  decode,
  toString: decode,
  bfeTypes: TYPES,
  bfeNamedTypes: NAMED_TYPES,
}
