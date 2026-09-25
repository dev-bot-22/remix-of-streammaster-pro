# PW-MARCO: uploaded app import + stream fixes

## 1. Project replace

Uploaded `pwmarco_offcl.zip` (Next.js app, folder `remix-of-lecturestream-pro-main`) ke saare files is project me copy honge (git metadata chhod ke). Iske baad GitHub connect karke pura updated code export ho sakta hai.

Note: ye Next.js project hai, isliye Lovable ka live preview isko run nahi karega — aapne confirm kiya hai ki theek hai. Code complete aur export-ready rahega.

## 2. Live lecture — naya API, direct CloudFront play

- `pages/api/get-live-url.ts` ab naye worker ko call karega:
  `https://pw-paid-stream.raghutiwari554-34f.workers.dev/api/get-video-url?batchId=...&subjectId=...&childId=...&videoType=penpencilvdo`
- Response ka `data.url + data.signedUrl` (direct CloudFront `index.m3u8`) player ko diya jayega — koi proxy nahi.
- `app/live/page.tsx` pehle se base URL + signed query split karke HLS player ko deta hai; wahi flow rahega, bas ab naye source se.
- Live me og-stream wala HLS API bilkul use nahi hoga.

Verify kiya gaya: aapke live IDs par ye link HTTP 200 deta hai (master playlist with 480p/360p variants).

## 3. Recorded DASH — proxy stream URL

- DASH ke liye usi worker ke response ka `proxy_stream_url` use hoga (signed MPD ke saath), jo `dashPlayer` ko pass hoga.
- Verified: signed MPD 200 return karta hai.

## 4. Recorded HLS — primary API + late-load/refresh error fix

- Primary (admin panel wali) HLS API: `https://og-stream.raghutiwari554-34f.workers.dev/api/{batch_id}/{subject_id}/{lecture_id}` — sirf recorded ke liye.
- Jo problem aa rahi hai uska cause mila: og-stream jo link deta hai wo heroku proxy ke through **bina CloudFront signature** ke jata hai, isliye CDN 403 deta hai (test me confirm hua). Refresh par kabhi chal jata hai kyunki proxy warm ho jata hai / cache lag jata hai.
- Fix:
  - og-stream ke double-wrapped proxy layer ko single layer kiya jayega aur short timeout + 2 retry ke saath call hoga (late load kam hoga).
  - Agar og-stream link 403/fail kare, to usi lecture ka **signed HLS** naye worker se banega: `data.url` ka `master.mpd` → `master.m3u8` (same signature). Test me ye 200 aur poori quality list (720/480/360/240) deta hai — yahi HLS ko reliable banayega.
  - Refresh-par-chalta-hai wali stuck screen ki jagah error par player me **"Change player" (HLS ⇄ DASH)** ka option dikhega, jaisa aapne kaha — automatic switch nahi.

## 5. Checks before finishing

Aapke diye IDs par test:
- Live (batch `698ad351…`) — HLS play
- Recorded (batch `698ad352…`) — HLS play aur DASH play
- Admin panel me primary stream API field sahi value dikhaye

## Technical notes

- `pages/api/get-live-url.ts`: PW token flow hata kar naye worker call par shift; response shape `{ success, url, signedUrl, fullUrl }` same rahegi taaki `app/live/page.tsx` na toote.
- `pages/api/primary-stream.ts`: og-stream call + normalize + retry, plus signed-HLS fallback resolver; sealed envelope (`/api/v/...`) mechanism same rahega.
- Naya helper `pages/api/paid-stream.ts` (ya lib util) jo worker response se `{ hlsSigned, dashProxy, mpdSigned }` nikale, live + recorded dono use karenge.
- `app/watch/WatchClient.tsx`: player switch state (HLS/DASH) + error par manual switch button.
