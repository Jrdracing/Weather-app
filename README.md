# Skies — weather for your three places

A modern, phone-first weather app. The home screen shows three big location cards, each with:
the current temperature and conditions, today's high/low and rain chance, and a 3-day outlook.

Tap a card to open that place. Everything is on one scrolling page with no extra menus:

- **Now**: temperature, conditions, feels-like, high/low
- **Rain over the next 12 hours**: a plain-language summary ("Rain likely from 4:00 PM") and an hour-by-hour chance chart
- **Hourly**: the next 24 hours
- **Next 3 days**: rain chance, rain amount and a temperature range bar for each day
- **Wind, humidity, UV and sunrise/sunset**

Swipe left or right (or use the tabs at the top) to jump between your three places.
Tap ✏️ on the home screen to change any of the three places (search, or "use my current location") and to switch between °C and °F.

Weather data comes from [Open-Meteo](https://open-meteo.com/), which is free and needs no API key.
The last forecast for each place is saved on the phone, so the app opens instantly and still shows data offline.

## Put it on your phone

The app is a Progressive Web App: plain HTML, CSS and JS with no build step. It has to be served over HTTPS, and GitHub Pages is the easiest way to do that:

1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch and `/ (root)`, then **Save**.
3. After about a minute, open the URL it gives you (`https://<user>.github.io/Weather-app/`) on your phone.
4. Install it:
   - **iPhone (Safari)**: tap Share → **Add to Home Screen**.
   - **Android (Chrome)**: tap ⋮ → **Install app** / **Add to Home screen**.

It then opens full-screen from its own icon, like a native app.

> GitHub Pages on a **private** repository needs a paid GitHub plan. Otherwise, make the repo public, or drop the folder onto any static host such as Netlify or Cloudflare Pages.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | All styling (glass panels, weather-based gradients) |
| `app.js` | Data fetching, caching, rendering, location editor |
| `sw.js` | Service worker for offline / instant loading |
| `manifest.webmanifest`, `icons/` | Home-screen install metadata and icons |
