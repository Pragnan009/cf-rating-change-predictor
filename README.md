# CF Rating Predictor

Predicts your Codeforces rating change for a contest — live mid-contest,
as a what-if, or validated against a contest CF already rated.

## Structure

```
app/
  cf_api.py     - Codeforces API client
  predictor.py  - the prediction math (Elo-style seed -> performance
                   rating -> delta)
  service.py    - shared pipeline (live mode vs validation mode), used
                   by both the CLI and the web API
  main.py       - FastAPI app: /api/predict, /api/health, serves docs/
docs/
  index.html, style.css, app.js  - the web UI (vanilla JS, no build step).
                   Named "docs" (not "static") because that's one of the
                   two folders GitHub Pages can serve directly.
cli.py          - command-line version
render.yaml     - Render.com deploy config
Procfile        - Railway/Heroku-style deploy config
```

## Why two deploys, not one

The predictor needs a live Python backend — it calls the Codeforces API,
does the seed/Elo math, and returns JSON. **GitHub Pages only serves
static files**, it can't run that Python. So there are two pieces:

1. **Backend** (the actual brains) → deploy to Render (free tier) — this
   is what does the work.
2. **Frontend** (`docs/`) → either let the backend serve it directly
   (simplest, one URL, already wired up), *or* publish it separately on
   GitHub Pages if you specifically want a `yourname.github.io/...` link.
   The frontend just calls the backend's API over the network either way.

If you don't care about the URL being `github.io` specifically, stop
after step 2 below — your Render URL already serves both the site and
the API together. Steps 3–4 are only for getting the extra `github.io`
link.

## 1. Get it into a repo

```bash
cd cf-rating-predictor
git init
git add .
git commit -m "CF Rating Predictor v1"
```

Create an empty repo on GitHub (github.com → New repository, don't
initialize it with a README), then:

```bash
git remote add origin https://github.com/<your-username>/cf-rating-predictor.git
git branch -M main
git push -u origin main
```

## 2. Deploy the backend to Render

1. [render.com](https://render.com) → New → Web Service → connect the
   GitHub repo you just pushed.
2. Render reads `render.yaml` automatically and fills in the build/start
   commands. Click **Deploy**.
3. You'll get a URL like `https://cf-rating-predictor.onrender.com` —
   that alone is a working site (frontend + API, same origin, nothing
   else to configure). Every future `git push` auto-redeploys it.

> Free-tier Render services sleep after inactivity and take ~30s to wake
> on the next request — fine for personal use, worth knowing.

## 3. (Optional) Point the frontend at that backend

Only needed if you're publishing `docs/` separately via GitHub Pages
(step 4). Edit `docs/index.html`:

```html
<script>
  window.CF_API_BASE = "https://cf-rating-predictor.onrender.com";
</script>
```

Commit and push that change.

## 4. (Optional) Turn on GitHub Pages for the `github.io` link

1. On GitHub: your repo → **Settings** → **Pages**.
2. Under "Build and deployment", set **Source** to "Deploy from a
   branch", branch **main**, folder **/docs**. Save.
3. GitHub gives you a link shortly after:
   `https://<your-username>.github.io/cf-rating-predictor/`

That page is now the frontend, talking to your Render backend over the
network (CORS is already open on the API for this). Two URLs, one app:
the `.github.io` one is what you'd share.

## Run it locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`.

```bash
python cli.py --handle tourist --contest 1900              # live, auto-detected rank
python cli.py --handle tourist --contest 1900 --rank 250    # live, what-if
```

## How the prediction works

1. Every other contestant is compared to you with the classic Elo formula:
   `P(you beat them) = 1 / (1 + 10^((their_rating - your_rating)/400))`
2. Summing those probabilities gives your **seed** — the rank you'd be
   expected to get if everyone performed exactly at their rating.
3. Binary-search for the rating at which your seed equals your actual
   rank — your performance rating for this contest.
4. `delta ≈ (performance_rating - old_rating) / 2`, clamped to a sane range.

Same family of approximation the CP community has reverse-engineered for
years — not CF's exact internal code (never published), but close enough
for a solid estimate.

### Two modes, auto-selected by `service.predict()`

- **Live mode** — contest running or just finished, not yet officially
  rated. Uses every `CONTESTANT`'s current rating (== pre-contest rating)
  plus live standings. Leave rank blank to auto-use your live provisional
  rank.
- **Validation mode** — contest already rated. Pulls real rating changes
  from CF and reports the prediction error — this is how you calibrate
  the model.

> Note: this sandbox's network can't reach codeforces.com directly, so
> the CF-API path was verified with mocked responses (batched lookups,
> dead-handle skipping, rank auto-detection, full FastAPI requests via
> `TestClient`) rather than a live contest. Run it locally / deployed to
> hit the real API.

## Roadmap

- **v2**: historical contest data, actual-vs-predicted graph, accuracy/MAE
  against real `contest.ratingChanges`, rating-range analysis
- **v3**: "what rank do I need to reach 1500?", what-if rank slider,
  solve A/B/C/D → estimated rating, personalized prediction from your own
  contest history, public API docs
