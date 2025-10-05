// server/tokenManager.js
import fetch from 'node-fetch';

const TOKEN_URL = 'https://api.horizon.elevancehealth.com/v2/oauth2/token';
const CLIENT_ID = 'piI7ubfBnm6SnZecRZ2KGeUeXOZVXRGS';
const CLIENT_SECRET = '3e36962c45464a9a83ca09e439cfe62e';
const GRANT_TYPE = 'client_credentials';
const REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes in ms

let accessToken = null;
let expiresAt = null;

async function fetchToken() {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: GRANT_TYPE
      })
    });
    if (!response.ok) {
      throw new Error(`Token fetch failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    accessToken = data.access_token;
    // If expires_in is provided, set expiresAt
    if (data.expires_in) {
      expiresAt = Date.now() + (data.expires_in * 1000);
    }
    console.log('[TokenManager] Token refreshed:', accessToken ? 'Success' : 'Failed');
  } catch (err) {
    console.error('[TokenManager] Error fetching token:', err);
    accessToken = null;
  }
}

function getToken() {
  return accessToken;
}

// Initial fetch
fetchToken();
// Refresh every 14 minutes
setInterval(fetchToken, REFRESH_INTERVAL);

export default {
  getToken
};
