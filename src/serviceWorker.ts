export const serviceWorkerScriptUrl = (baseUrl: string) =>
  `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}sw.js`
