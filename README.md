<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a35be330-d7dd-4fb3-bded-8b365c2c0764

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set required keys in `.env.local` (see `.env.example`), especially:
   - `INCEPTION_API_KEY` (primary chat model: `mercury-2`)
   - `CEREBRAS_API_KEY` (fallback + image-attached chat requests)
   - `WEB_SEARCH_API` (optional `//web-search` action)
   - `DEV_MODEL_CONTROL_SECRET` (optional dev-only `//` model controls)
3. Run the app:
   `npm run dev`
