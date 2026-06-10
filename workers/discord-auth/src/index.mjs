// Discord → Firebase auth bridge.
//
// GET /login?state=<csrf>&return=<app url>   → 302 to Discord's consent screen
// GET /callback?code=…&state=…               → code exchange + /users/@me, then
//   302 back to <return>#/signin?dt=<firebase custom token>&state=<csrf>&dn=…&av=…
//   (the token rides in the URL hash, so it never reaches any server log).
//
// Secrets: DISCORD_CLIENT_SECRET, FIREBASE_SA_KEY (service-account JSON).
// Vars:    DISCORD_CLIENT_ID, APP_URLS (CSV origin allowlist).

const enc = new TextEncoder()

const b64url = (data) => {
  const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const b64urlDecode = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'))

const pemToPkcs8 = (pem) => {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

/** Mint a Firebase custom token (RS256 JWT signed by the service account). */
export async function mintCustomToken(saEmail, privateKeyPem, uid, nowSeconds) {
  const iat = nowSeconds ?? Math.floor(Date.now() / 1000)
  const claims = {
    iss: saEmail,
    sub: saEmail,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat,
    exp: iat + 3600,
    uid,
  }
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned))
  return `${unsigned}.${b64url(sig)}`
}

/** The return URL, iff its origin is allowlisted (blocks token exfiltration). */
function allowedReturn(env, ret) {
  try {
    const url = new URL(ret)
    const ok = (env.APP_URLS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(url.origin)
    return ok ? url : null
  } catch {
    return null
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    if (url.pathname === '/login') {
      const state = url.searchParams.get('state') ?? ''
      const ret = allowedReturn(env, url.searchParams.get('return') ?? '')
      if (!state || !ret) return new Response('Bad request', { status: 400 })
      const authz = new URL('https://discord.com/oauth2/authorize')
      authz.searchParams.set('client_id', env.DISCORD_CLIENT_ID)
      authz.searchParams.set('redirect_uri', `${url.origin}/callback`)
      authz.searchParams.set('response_type', 'code')
      authz.searchParams.set('scope', 'identify')
      // Round-trip the app's CSRF state + validated return URL through Discord.
      authz.searchParams.set('state', b64url(JSON.stringify({ s: state, r: ret.href })))
      return Response.redirect(authz.href, 302)
    }

    if (url.pathname === '/callback') {
      let packed
      try {
        packed = JSON.parse(b64urlDecode(url.searchParams.get('state') ?? ''))
      } catch {
        return new Response('Bad state', { status: 400 })
      }
      const ret = allowedReturn(env, packed.r)
      if (!ret) return new Response('Bad state', { status: 400 })
      const fail = (code) => {
        const back = new URL(ret)
        back.hash = `/signin?derr=${code}`
        return Response.redirect(back.href, 302)
      }

      const code = url.searchParams.get('code')
      if (!code) return fail('denied') // user cancelled on the consent screen

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      })
      if (!tokenRes.ok) return fail('exchange')
      const { access_token } = await tokenRes.json()

      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      if (!meRes.ok) return fail('profile')
      const me = await meRes.json()

      let dt
      try {
        // trim() also strips a UTF-8 BOM — Windows pipes love to prepend one.
        const sa = JSON.parse(env.FIREBASE_SA_KEY.trim())
        dt = await mintCustomToken(sa.client_email, sa.private_key, `discord:${me.id}`)
      } catch (err) {
        // Typical cause: FIREBASE_SA_KEY isn't the full service-account JSON
        // (the interactive `wrangler secret put` prompt truncates multi-line
        // pastes — pipe the file in instead). Details show in `wrangler tail`.
        console.error('mint failed:', err instanceof Error ? err.message : String(err))
        return fail('mint')
      }

      const back = new URL(ret)
      const params = new URLSearchParams({
        dt,
        state: packed.s,
        dn: me.global_name || me.username || 'Discord user',
        av: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png` : '',
      })
      back.hash = `/signin?${params}`
      return Response.redirect(back.href, 302)
    }

    return new Response('Not found', { status: 404 })
  },
}
