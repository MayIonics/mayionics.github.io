function decodeBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function adminEmails(value = '') {
  return new Set(value.split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
}

function validTeamDomain(domain) {
  return typeof domain === 'string' && /^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain);
}

export function authorizeAccessClaims(claims, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!validTeamDomain(env?.CF_ACCESS_TEAM_DOMAIN) || !env?.CF_ACCESS_AUD || !env?.ADMIN_EMAILS) {
    return { ok: false, status: 500, reason: 'Admin Access configuration is incomplete.' };
  }
  if (!claims || typeof claims !== 'object') return { ok: false, status: 401, reason: 'Invalid Access claims.' };

  const expectedIssuer = `https://${env.CF_ACCESS_TEAM_DOMAIN}`;
  if (claims.iss !== expectedIssuer) return { ok: false, status: 401, reason: 'Access issuer mismatch.' };

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(env.CF_ACCESS_AUD)) return { ok: false, status: 401, reason: 'Access audience mismatch.' };

  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds) return { ok: false, status: 401, reason: 'Access token expired.' };
  if (claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > nowSeconds)) return { ok: false, status: 401, reason: 'Access token is not active.' };

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email) return { ok: false, status: 401, reason: 'Access identity is missing.' };
  if (!adminEmails(env.ADMIN_EMAILS).has(email)) return { ok: false, status: 403, reason: 'Access identity is not an approved administrator.' };

  return { ok: true, status: 200, email, claims };
}

export async function verifyAccessJwt(request, env, options = {}) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, status: 401, reason: 'Cloudflare Access assertion is required.' };
  if (!validTeamDomain(env?.CF_ACCESS_TEAM_DOMAIN) || !env?.CF_ACCESS_AUD || !env?.ADMIN_EMAILS) {
    return { ok: false, status: 500, reason: 'Admin Access configuration is incomplete.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, reason: 'Malformed Access assertion.' };

  try {
    const header = decodeJsonPart(parts[0]);
    const claims = decodeJsonPart(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      return { ok: false, status: 401, reason: 'Unsupported Access assertion.' };
    }

    const claimResult = authorizeAccessClaims(claims, env, options.nowSeconds);
    if (!claimResult.ok) return claimResult;

    const fetchFn = options.fetchFn ?? fetch;
    const response = await fetchFn(`https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    if (!response.ok) return { ok: false, status: 503, reason: 'Unable to retrieve Access signing keys.' };
    const keySet = await response.json();
    const jwk = Array.isArray(keySet?.keys) ? keySet.keys.find(key => key.kid === header.kid) : null;
    if (!jwk) return { ok: false, status: 401, reason: 'Access signing key was not found.' };

    const subtle = options.subtle ?? crypto.subtle;
    const key = await subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return { ok: false, status: 401, reason: 'Access assertion signature is invalid.' };

    return claimResult;
  } catch {
    return { ok: false, status: 401, reason: 'Access assertion could not be verified.' };
  }
}
