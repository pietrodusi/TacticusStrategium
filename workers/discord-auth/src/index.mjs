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

// Cap on the opaque params we round-trip — legit values are tiny (a UUID and a
// short URL); anything larger is junk and just wastes CPU/memory.
const MAX_PARAM = 512

/**
 * The return URL, iff BOTH its origin is allowlisted AND its path is the app's
 * base. Origin alone is not enough: *.github.io is a shared origin hosting all
 * of an account's repos, so a token redirect must be pinned to this app's path.
 */
function allowedReturn(env, ret) {
  if (typeof ret !== 'string' || ret.length > MAX_PARAM) return null
  try {
    const url = new URL(ret)
    const originOk = (env.APP_URLS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(url.origin)
    // App is served from /TacticusStrategium/ (prod and local preview); reject
    // any other path so the token can't be steered elsewhere on the origin.
    const pathOk = url.pathname === '/' || url.pathname.startsWith('/TacticusStrategium/')
    // Only the origin+path are trusted; drop any attacker-supplied query/hash.
    return originOk && pathOk ? new URL(url.origin + url.pathname) : null
  } catch {
    return null
  }
}

// 302 with headers appropriate for a URL that may carry a token in its hash:
// no referrer leakage, no caching by intermediaries.
function redirect(href) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: href,
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    // This is a top-level redirect flow — only GET is ever legitimate.
    if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

    if (url.pathname === '/login') {
      const state = url.searchParams.get('state') ?? ''
      const ret = allowedReturn(env, url.searchParams.get('return') ?? '')
      if (!state || state.length > MAX_PARAM || !ret) return new Response('Bad request', { status: 400 })
      const authz = new URL('https://discord.com/oauth2/authorize')
      authz.searchParams.set('client_id', env.DISCORD_CLIENT_ID)
      authz.searchParams.set('redirect_uri', `${url.origin}/callback`)
      authz.searchParams.set('response_type', 'code')
      authz.searchParams.set('scope', 'identify')
      // Round-trip the app's CSRF state + validated return URL through Discord.
      authz.searchParams.set('state', b64url(JSON.stringify({ s: state, r: ret.href })))
      return redirect(authz.href)
    }

    if (url.pathname === '/callback') {
      const rawState = url.searchParams.get('state') ?? ''
      if (rawState.length > MAX_PARAM) return new Response('Bad state', { status: 400 })
      let packed
      try {
        packed = JSON.parse(b64urlDecode(rawState))
      } catch {
        return new Response('Bad state', { status: 400 })
      }
      const ret = allowedReturn(env, packed.r)
      if (!ret) return new Response('Bad state', { status: 400 })
      const fail = (code) => {
        const back = new URL(ret)
        back.hash = `/signin?derr=${code}`
        return redirect(back.href)
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
      } catch {
        // Static message only — never echo the error, which can contain a
        // fragment of the malformed FIREBASE_SA_KEY secret. Typical cause: the
        // secret isn't the full service-account JSON (pipe the file in, don't
        // paste at the prompt). Inspect the SA key in the dashboard if it recurs.
        console.error('mint failed (check FIREBASE_SA_KEY)')
        return fail('mint')
      }

      const back = new URL(ret)
      const params = new URLSearchParams({
        dt,
        state: typeof packed.s === 'string' ? packed.s : '',
        dn: me.global_name || me.username || 'Discord user',
        av: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png` : '',
      })
      back.hash = `/signin?${params}`
      return redirect(back.href)
    }

    return new Response('Not found', { status: 404 })
  },
}
