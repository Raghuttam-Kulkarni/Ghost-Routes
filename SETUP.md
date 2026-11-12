# Setup, step by step

Do these in order. Each step says what you should see when it worked.

## 0. Get the code onto the laptop

The integrated app lives in this chat's workspace, not on GitHub yet. Either ask for it to be pushed
to a branch, or open the Files panel and download it. Nothing is committed so far.

## 1. Check Node

```bash
node -v
```

Need **v20.9.0 or newer** (Next 16 refuses anything lower). If it is older:

```bash
# macOS/Linux with nvm
nvm install --lts && nvm use --lts
```

On Windows, install the current LTS from nodejs.org and reopen the terminal.

## 2. Install dependencies

```bash
cd Ghost-Routes
npm install
```

First run takes about a minute. You should end with something like `added 584 packages` and no
`npm error`.

## 3. Get a Gemini key

1. Open https://aistudio.google.com/apikey and sign in with a Google account.
2. Click **Create API key** (pick any project if asked).
3. Copy the key. It starts with `AIza…`.

The free tier is enough for a hackathon; each submission costs one or two model calls.

## 4. Create `.env.local`

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill in the key (no quotes, no spaces):

```dotenv
GEMINI_API_KEY=AIza...your-key...
```

Leave the Supabase lines empty if you are not using a database yet. `.env.local` is gitignored — never
commit it or paste the key into chat.

## 5. (Optional) Connect Supabase

1. https://supabase.com → **New project**. Name it, set a database password, pick the closest region
   (Mumbai or Singapore for Bengaluru). Wait ~2 minutes for provisioning.
2. Left sidebar → **SQL Editor** → **New query**. Paste the whole of `supabase/schema.sql` and click
   **Run**. You should see `Success. No rows returned`.
3. Left sidebar → **Project Settings** → **API**. Copy three values into `.env.local`:

```dotenv
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...        # "anon" / "public" key
SUPABASE_SERVICE_ROLE_KEY=eyJ... # "service_role" — secret, server-only
```

`SUPABASE_SERVICE_ROLE_KEY` is what makes seat requests write to the database; without it bookings
fall back to a local file.

## 6. Start the app

```bash
npm run dev
```

Open http://localhost:3000. The terminal should say `✓ Ready`. Keep the terminal open — closing it
stops the app.

## 7. Prove the AI works

```bash
curl -s -X POST http://localhost:3000/api/normalize-route \
  -H 'content-type: application/json' \
  -d '{"rawInput":"shared auto from Majestic to Koramangala"}'
```

Windows PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/normalize-route -ContentType 'application/json' -Body '{"rawInput":"shared auto from Majestic to Koramangala"}' | Select-Object isFallback, routeName, vehicleType
```

- `"isFallback": false` → the live model answered. Good to go.
- `"isFallback": true` → no key, or a bad key. Fix `.env.local`, restart `npm run dev`, retry.

## 8. Prove storage works

```bash
curl -s -X POST http://localhost:3000/api/routes \
  -H 'content-type: application/json' \
  -d '{"origin":"Majestic Bus Station, Bengaluru","destination":"Forum Mall, Koramangala, Bengaluru","description":"shared auto, INR 25"}'
```

Look for `"normalized": true` (AI ran) and non-null `origin_lat`/`dest_lat` (geocoding worked). With
Supabase connected, the row also appears in **Table Editor → routes**.

Then clear it:

```bash
rm -rf .data          # local store
# Supabase: run in SQL editor
# delete from public.routes; delete from public.bookings;
```

## 9. Rehearse

1. Open the app and press **Esc** so the intro tour is marked as seen.
2. Follow [DEMO.md](DEMO.md) once end to end.
3. Clear the data again, and leave the browser on a fresh tab.

## 10. Commit your own copy

```bash
git status                     # confirm .env.local is NOT listed
git checkout -b integration
git add -A
git commit -m "Integrate frontend UI with backend storage and ai-maps route AI"
git push -u origin integration
```

## When something breaks

| Symptom | Cause | Fix |
| --- | --- | --- |
| `next: command not found` | dependencies missing | `npm install` |
| Port 3000 in use | another server | use the URL Next prints, or `npm run dev -- -p 3001` |
| `isFallback: true` | key missing/invalid | fix `.env.local`, restart dev |
| Submit returns 500 with Supabase set | schema not run, or wrong URL/key | re-run `supabase/schema.sql`, check the three values |
| Route saves but is not drawn | geocoding found no place | retry with `Majestic Bus Station, Bengaluru` |
| "request a seat" returns 401 | not signed in | click the account icon → **Continue** |
| Map is blank/grey | tiles blocked (no internet) | use a hotspot |
| Fonts error at startup | started while offline | reconnect and restart `npm run dev` |
