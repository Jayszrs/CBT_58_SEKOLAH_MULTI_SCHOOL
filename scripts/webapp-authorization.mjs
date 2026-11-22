export function extractAuthorizationUrl(html, expectedEmail, allowedScopes) {
  const literal = html.match(/window\.open\('([^']+)'/)?.[1];
  if (!literal) return undefined;
  // Decode Google's JavaScript string as data; never execute the returned script.
  const decoded = literal.replace(/\\x([0-9a-f]{2})/gi, (_, value) => String.fromCharCode(parseInt(value,16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, value) => String.fromCharCode(parseInt(value,16)))
    .replace(/\\\//g, '/');
  const url = new URL(decoded);
  if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/auth') throw Error('Google authorization URL tidak sesuai.');
  if (url.searchParams.get('redirect_uri') !== 'https://script.google.com/oauthcallback') throw Error('Callback otorisasi tidak sesuai.');
  if (url.searchParams.get('login_hint')?.toLowerCase() !== expectedEmail.toLowerCase()) throw Error('Email otorisasi tidak sesuai pemilik.');
  const scopes = (url.searchParams.get('scope') || '').split(/\s+/).filter(Boolean);
  if (!scopes.length || scopes.some(scope => !allowedScopes.includes(scope))) throw Error('Scope otorisasi berbeda dari manifest aplikasi.');
  return url.href;
}

export function inspectWebAppHtml(html, school, allowedScopes) {
  if (typeof html !== 'string') return {status:'UNEXPECTED_RESPONSE'};
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || '';
  if (title === 'Authorization needed') {
    return {status:'AUTHORIZATION_REQUIRED',title,authorization_url:extractAuthorizationUrl(html,school.account_email,allowedScopes)};
  }
  if (title === `CBT | ${school.school_name}` && html.includes('APP_GLOBAL_CONFIG')) return {status:'APP_RENDERED',title};
  return {status:'UNEXPECTED_PAGE',title};
}
