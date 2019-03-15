module.exports = class Memory {
  constructor (raw) {
    this._raw = raw
  }

  write (offset, length, value) {
    const m = new Uint8Array(this._raw.buffer, offset, length)
    m.set(value)
  }

  read (offset, length) {
    return new Uint8Array(this._raw.buffer, offset, length)
  }
}
