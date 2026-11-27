/**
 * Google Cloud settings for sync (0015 §2). These are public by design: a browser app has
 * no client secret. Project "Simple Budget" (created 2026-11-22): OAuth web client with the
 * dev origins http://localhost:5173 and :4173; API key limited to those sites and the Picker API.
 * A new public origin must be added to both in the Google Cloud console.
 */
export const GOOGLE_CONFIG = {
  /** OAuth 2.0 client id (web application). */
  clientId: '437554241666-ch4heef0a4jqfgn0119dlp8f2red1b4n.apps.googleusercontent.com',
  /** API key for the Google Picker. */
  apiKey: 'AIzaSyACVfCq-1tnwQPAG4eUSba41_20xlKivoE',
  /** Cloud project number, so a picked sheet is granted to this app (drive.file). */
  appId: '437554241666',
}

export const isGoogleConfigured = () => !Object.values(GOOGLE_CONFIG).some(v => v.startsWith('PLACEHOLDER_'))

/** The only scope asked for: files this app created or the user picked (0015 Q2). */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
/** Redirect sign-in (D004). The redirect URI is the app's own address, added under Authorized redirect URIs. */
export const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const REDIRECT_PENDING_KEY = 'sb-signin-pending'
export const GSI_SCRIPT = 'https://accounts.google.com/gsi/client'
export const GAPI_SCRIPT = 'https://apis.google.com/js/api.js'
export const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
