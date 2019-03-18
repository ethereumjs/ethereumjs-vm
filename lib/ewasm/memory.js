module.exports = class Memory {
  constructor (raw) {
    this._raw = raw
  }

  write (offset, length, value) {
    // Grow if needed
    if (this._raw.buffer.byteLength < length) {
      const diff = length - this._raw.buffer.byteLength
      const pageSize = 64 * 1024
      this._raw.grow(Math.ceil(diff / pageSize))
    }

    const m = new Uint8Array(this._raw.buffer, offset, length)
    m.set(value)
  }

  read (offset, length) {
    return new Uint8Array(this._raw.buffer, offset, length)
  }
}
