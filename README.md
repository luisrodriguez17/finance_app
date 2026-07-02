# Finanzas — Mobile (PWA)

Personal finance tracker. Installable as a PWA on Android (or any device).

## Local development

```sh
npm install
npm run dev
```

## Deploying to GitHub Pages

1. Create a new GitHub repo (any name — the workflow auto-detects the repo name).
2. Push this project to it:

   ```sh
   git init
   git add .
   git commit -m "Initial PWA setup"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<repo>.git
   git push -u origin main
   ```

3. In the repo on github.com → **Settings → Pages** → set "Build and deployment" source to **GitHub Actions**.
4. The `Deploy PWA to GitHub Pages` workflow runs on every push to `main`. The first run will publish the site to `https://<your-user>.github.io/<repo>/`.

## Installing on Android

1. Open the deployed URL in Chrome on your phone.
2. Tap the menu (⋮) → **Install app** (or "Add to Home screen").
3. The app appears in the launcher and runs full-screen, with offline support thanks to the service worker.

Subsequent visits update automatically: on each load the service worker checks for a new bundle and refreshes in the background.

## Notes

- App data is stored in the browser's `localStorage`, scoped to the deployed origin. Installing the PWA doesn't move data between origins.
- To migrate data from another deployment (e.g. desktop): open Settings → Paste JSON → paste the exported state.
