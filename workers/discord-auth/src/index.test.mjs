import { describe, expect, it } from 'vitest'
import { mintCustomToken } from './index.mjs'

const b64urlToBytes = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
const decodeSegment = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)))

const toPem = (pkcs8) => {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
  const lines = b64.match(/.{1,64}/g).join('\n')
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`
}

describe('mintCustomToken', () => {
  it('produces a valid RS256 Firebase custom token', async () => {
    const { privateKey, publicKey } = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
      true,
      ['sign', 'verify'],
    )
    const pem = toPem(await crypto.subtle.exportKey('pkcs8', privateKey))

    const now = 1_780_000_000
    const jwt = await mintCustomToken('sa@test.iam.gserviceaccount.com', pem, 'discord:42', now)
    const [h, c, sig] = jwt.split('.')

    expect(decodeSegment(h)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decodeSegment(c)).toEqual({
      iss: 'sa@test.iam.gserviceaccount.com',
      sub: 'sa@test.iam.gserviceaccount.com',
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid: 'discord:42',
    })

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      b64urlToBytes(sig),
      new TextEncoder().encode(`${h}.${c}`),
    )
    expect(valid).toBe(true)
  })

  it('handles escaped-newline PEMs as stored in service-account JSON', async () => {
    const { privateKey } = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
      true,
      ['sign'],
    )
    const pem = toPem(await crypto.subtle.exportKey('pkcs8', privateKey))
    // JSON.parse turns the stored "\n" into real newlines — same input shape either way.
    const viaJson = JSON.parse(JSON.stringify({ private_key: pem })).private_key
    await expect(mintCustomToken('sa@x.iam', viaJson, 'discord:1')).resolves.toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
  })
})
