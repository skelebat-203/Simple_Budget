/**
 * Google Cloud settings for sync (0015 §2). These are public by design: a browser app has
 * no client secret. PLACEHOLDER values: the human creates the Google Cloud project, the
 * OAuth client (web application, the app's origins as allowed origins), an API key limited
 * to the Picker API, and the consent screen, then fills these in (0015 Q10).
 */
export const GOOGLE_CONFIG = {
  /** OAuth 2.0 client id, e.g. 1234-abc.apps.googleusercontent.com. PLACEHOLDER. */
  clientId: 'PLACEHOLDER_GOOGLE_OAUTH_CLIENT_ID',
  /** API key for the Google Picker. PLACEHOLDER. */
  apiKey: 'PLACEHOLDER_GOOGLE_PICKER_API_KEY',
  /** Cloud project number, so a picked sheet is granted to this app (drive.file). PLACEHOLDER. */
  appId: 'PLACEHOLDER_GOOGLE_CLOUD_PROJECT_NUMBER',
}

export const isGoogleConfigured = () => !Object.values(GOOGLE_CONFIG).some(v => v.startsWith('PLACEHOLDER_'))

/** The only scope asked for: files this app created or the user picked (0015 Q2). */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const GSI_SCRIPT = 'https://accounts.google.com/gsi/client'
export const GAPI_SCRIPT = 'https://apis.google.com/js/api.js'
export const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
