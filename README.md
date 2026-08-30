# Web Podcasts

A static, curated directory for 100 free Chinese-language and English podcasts. Feed metadata is refreshed by GitHub Actions; episode audio always plays directly from the publisher or podcast host and is never proxied or stored.

## Local preview

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Update feeds

```bash
node scripts/update-feeds.mjs
node scripts/generate-seo.mjs
```

The updater keeps the last successful data for a show if its feed is temporarily unavailable. The homepage catalog contains three recent episodes per show; `shows/*.json` contains feed-provided episodes for on-demand history views. The SEO generator creates crawlable show pages under `shows/<id>/` and refreshes `sitemap.xml` without changing the interactive app routes.

## Publish

Publish the repository root with GitHub Pages. The scheduled workflow refreshes `episodes.json` every six hours.
