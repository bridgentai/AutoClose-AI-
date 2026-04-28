import { google } from 'googleapis';
import { ENV } from '../config/env.js';
import { getGoogleToken, updateGoogleAccessToken } from '../repositories/googleTokenRepository.js';

export function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_REDIRECT_URI
  );
}

export async function getAuthedOAuth2ForUser(userId: string) {
  const token = await getGoogleToken(userId);
  if (!token) return null;
  const oauth2 = getGoogleOAuth2Client();
  oauth2.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? undefined,
    expiry_date: token.expiry_date ?? undefined,
  });
  if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      if (credentials.access_token && credentials.expiry_date) {
        await updateGoogleAccessToken(userId, credentials.access_token, credentials.expiry_date);
        oauth2.setCredentials(credentials);
      }
    } catch (e) {
      console.error('[GoogleDriveOAuth] refresh token error:', e);
      return null;
    }
  }
  return oauth2;
}
