import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

export async function findGoogleOwnerCredentials(expectedEmail, { initAuth, getUserInfo }) {
  // Named credentials keep earlier accounts available without switching the default.
  for (const userKey of [expectedEmail, 'default']) {
    const { credentials } = await initAuth({ userKey });
    if (!credentials) continue;
    const user = await getUserInfo(credentials);
    if (user?.email?.toLowerCase() === expectedEmail.toLowerCase()) return credentials;
  }
  throw Error(`Akun clasp ${expectedEmail} belum tersedia. Jalankan clasp login --user ${expectedEmail} dan pilih email yang sama.`);
}

export async function googleOwnerApi(expectedEmail, quotaProjectId) {
  const directory = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@google', 'clasp', 'build', 'src');
  const { initAuth, getUserInfo } = await import(pathToFileURL(path.join(directory, 'auth', 'auth.js')));
  const credentials = await findGoogleOwnerCredentials(expectedEmail, { initAuth, getUserInfo });
  return async function request(url, method = 'GET', data) {
    const headers = quotaProjectId && url.startsWith('https://sheets.googleapis.com/') ? { 'x-goog-user-project': quotaProjectId } : undefined;
    for(let attempt=0;attempt<3;attempt++){
      try { return (await credentials.request({ url, method, data, headers })).data; }
      catch (error) {
        const status=error.response?.status;
        // Newly created deployments can take a moment to appear on read replicas.
        // Retry reads only; a lost create response must be resumed by its resource ID.
        if(method.toUpperCase()==='GET'&&attempt<2&&([404,429,500,502,503,504].includes(status)||['ECONNRESET','ETIMEDOUT'].includes(error.code))){
          await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));continue;
        }
        // Gaxios errors include the authorization header; emit only the API message.
        throw Error(`Google API ${status || ''}: ${error.response?.data?.error?.message || error.message}`);
      }
    }
  };
}
