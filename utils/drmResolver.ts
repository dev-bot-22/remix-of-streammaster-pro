import axios from "axios";

/**
 * Fetches the MPD file and extracts the default_KID
 */
export async function extractKidFromMpd(mpdUrl: string): Promise<string | null> {
  if (!mpdUrl) return null;
  try {
    const res = await axios.get(mpdUrl, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const xml = res.data;
    if (typeof xml !== "string") return null;

    // Search for default_KID in the XML manifest
    const kidMatch = xml.match(/default_KID="([\w-]+)"/i);
    if (kidMatch && kidMatch[1]) {
      const kid = kidMatch[1].replace(/-/g, "").toLowerCase();
      console.log(`[drmResolver] Extracted KID "${kid}" from MPD URL: ${mpdUrl}`);
      return kid;
    }
  } catch (err: any) {
    console.warn(`[drmResolver] Failed to extract KID from MPD: ${mpdUrl}`, err.message);
  }
  return null;
}

export async function fetchClearKeysFromPwThor(kid: string): Promise<Record<string, string> | null> {
  if (!kid) return null;

  const token = process.env.PWTHOR_AUTH_TOKEN;
  if (token) {
    try {
      console.log(`[drmResolver] Attempting direct resolution from pwthor.live for kid: ${kid}`);
      const res = await axios.get(`https://pwthor.live/api/get-otp?kid=${kid}`, {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://pwthor.live/",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cookie": `auth_token=${token}`
        }
      });

      let clearKeys = null;
      if (res.data) {
        if (res.data.clearKeys) {
          clearKeys = res.data.clearKeys;
        } else if (res.data.data && res.data.data.clearKeys) {
          clearKeys = res.data.data.clearKeys;
        }
      }

      if (clearKeys) {
        console.log(`[drmResolver] Successfully resolved ClearKey directly from pwthor.live for kid: ${kid}`);
        return clearKeys;
      }
    } catch (err: any) {
      console.warn(`[drmResolver] Direct pwthor.live fetch failed for kid: ${kid}:`, err.message);
    }
  } else {
    console.warn(`[drmResolver] PWTHOR_AUTH_TOKEN is not defined in environment variables.`);
  }

  // Fallback to Worker Proxy if direct fetch fails or is not configured
  try {
    console.log(`[drmResolver] Attempting fallback resolution via Worker proxy for kid: ${kid}`);
    const res = await axios.get(`${process.env.DRM_KEY_API || "https://pwthorkid.help-codewithvivek.workers.dev"}/?kid=${kid}`, {
      timeout: 5000,
    });

    let clearKeys = null;
    if (res.data) {
      if (res.data.clearKeys) {
        clearKeys = res.data.clearKeys;
      } else if (res.data.data && res.data.data.clearKeys) {
        clearKeys = res.data.data.clearKeys;
      }
    }

    if (clearKeys) {
      console.log(`[drmResolver] Successfully resolved ClearKey via Worker proxy for kid: ${kid}`);
      return clearKeys;
    }
  } catch (err: any) {
    console.warn(`[drmResolver] Worker proxy resolution failed for kid: ${kid}:`, err.message);
  }

  return null;
}
