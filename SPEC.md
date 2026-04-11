# UpList — Product & Technical Specification

## Overview

UpList is a solo-use progressive web app that turns a photo and a few notes into a
publish-ready eBay listing. The user uploads an image, optionally adds context, and an
AI model returns a full draft (title, description, item specifics, category, condition,
and suggested price). The user reviews and edits the draft, then publishes directly to
eBay via the eBay Sell API — all from a single installable PWA.

---

## Stack

| Concern | Technology |
|---|---|
| Markup | Semantic HTML5 |
| Styling | Modern CSS (custom properties, layers, container queries, `:has`) |
| Scripting | Vanilla modern JS (ES modules, no bundler) |
| Components | Native HTML Web Components (`customElements`, Shadow DOM where appropriate) |
| Reactivity | [Datastar](https://data-star.dev) (SSE-driven signals + actions) |
| Server | Node.js / Express (SSE endpoint, REST endpoints) |
| Templating | [Eta](https://eta.js.org) server-side templates |
| Database | [Turso](https://turso.tech) (libSQL / SQLite at the edge) |
| Auth | Email + password (bcrypt) and OAuth (Google, GitHub) via a thin session layer |
| UI Kit | [Kelp UI](https://kelpui.com) component library |
| PWA | Web App Manifest + Service Worker (offline read + write with background sync) |
| AI | Provider-agnostic adapter (default: Claude Vision; swappable via env var) |
| eBay | eBay Sell API (OAuth 2.0) |

---

## Core User Stories

1. **List an item** — Upload a photo, add optional notes, receive an AI-drafted listing in seconds.
2. **Review & edit draft** — Adjust title, description, specifics, category, condition, and price before publishing.
3. **Publish to eBay** — One button sends the listing to eBay via the Sell API.
4. **Manage drafts** — View, edit, and delete saved drafts from a dashboard.
5. **Offline resilience** — Create drafts and edit existing ones without connectivity; sync automatically when back online.
6. **Account** — Register with email/password or sign in with Google or GitHub.

---

## Information Architecture

```
/                   → Landing / login (unauthenticated)
/dashboard          → Drafts list + quick-create button
/items/new          → Item creation wizard (photo + notes → AI draft)
/items/:id          → Draft review & edit
/items/:id/publish  → Publish confirmation + eBay result
/settings           → Account, eBay connection, AI provider config
/auth/login
/auth/register
/auth/callback/:provider   (OAuth return)
```

---

## Data Model (Turso / libSQL)

### `users`
```sql
id          TEXT PRIMARY KEY   -- nanoid
email       TEXT UNIQUE NOT NULL
password    TEXT               -- bcrypt hash, NULL for OAuth-only accounts
name        TEXT
avatar_url  TEXT
created_at  INTEGER            -- Unix ms
```

### `oauth_accounts`
```sql
id           TEXT PRIMARY KEY
user_id      TEXT REFERENCES users(id)
provider     TEXT               -- 'google' | 'github'
provider_uid TEXT
access_token TEXT               -- encrypted at rest
refresh_token TEXT
expires_at   INTEGER
```

### `ebay_connections`
```sql
id            TEXT PRIMARY KEY
user_id       TEXT REFERENCES users(id)
access_token  TEXT               -- encrypted
refresh_token TEXT               -- encrypted
expires_at    INTEGER
scope         TEXT
```

### `items`
```sql
id              TEXT PRIMARY KEY   -- nanoid
user_id         TEXT REFERENCES users(id)
status          TEXT               -- 'draft' | 'published' | 'failed'
image_url       TEXT               -- stored object path or data URI (offline)
image_blob      BLOB               -- offline cache (nullable, cleared after sync)
notes           TEXT
title           TEXT
description     TEXT
item_specifics  TEXT               -- JSON object
category_id     TEXT
condition       TEXT
suggested_price REAL
final_price     REAL
currency        TEXT DEFAULT 'USD'
ebay_listing_id TEXT               -- populated after publish
ai_provider     TEXT               -- which adapter was used
ai_model        TEXT
created_at      INTEGER
updated_at      INTEGER
synced_at       INTEGER            -- NULL = pending offline sync
```

### `sessions`
```sql
id         TEXT PRIMARY KEY
user_id    TEXT REFERENCES users(id)
token      TEXT UNIQUE
expires_at INTEGER
```

---

## Server Architecture

### Express App Structure

```
server/
  index.js          -- entry, app init, middleware
  router.js         -- route registration
  routes/
    auth.js         -- login, register, OAuth, logout
    items.js        -- CRUD + SSE stream for AI generation
    ebay.js         -- OAuth connect, publish endpoint
    sync.js         -- offline sync batch endpoint
  sse/
    ai-stream.js    -- SSE handler: streams AI draft tokens to client
  ai/
    adapter.js      -- provider-agnostic interface
    providers/
      claude.js
      openai.js
  ebay/
    client.js       -- eBay Sell API wrapper
    auth.js         -- eBay OAuth flow
  db/
    client.js       -- Turso libSQL client
    migrations/     -- SQL migration files
  templates/        -- Eta .eta files
  middleware/
    session.js
    auth-guard.js
```

### SSE + Datastar Pattern

The AI draft generation uses a **server-sent events stream**:

1. Client `POST /items/:id/generate` — sends image (base64) + notes.
2. Server validates, calls AI adapter, opens SSE response.
3. As AI tokens arrive, server emits Datastar **merge-signals** fragments:
   - `title`, `description`, `item_specifics`, `category_id`, `condition`, `suggested_price`
4. Client signals update reactively; fields fill in real-time.
5. On stream close, server persists the draft to Turso.

```
Client (Datastar signals)          Express SSE endpoint
      │                                    │
      │── POST /items/:id/generate ────────▶│
      │                                    │── AI adapter stream
      │◀── event: datastar-merge-signals ──│ (tokens)
      │    (title, description, …)         │
      │◀── event: datastar-merge-signals ──│
      │    (specifics, price, …)           │
      │◀── event: datastar-execute-script ─│ (done signal)
```

---

## AI Adapter Interface

```js
// ai/adapter.js
export async function* generateListing({ imageBase64, mimeType, notes, provider }) {
  const mod = await import(`./providers/${provider}.js`);
  yield* mod.generate({ imageBase64, mimeType, notes });
}

// Each provider yields structured partial objects:
// { field: 'title', value: 'Vintage Leather Jacket …' }
// { field: 'description', value: '…' }
// { field: 'item_specifics', value: { Brand: '…', Size: 'M' } }
// { field: 'category_id', value: '11484' }
// { field: 'condition', value: 'USED_GOOD' }
// { field: 'suggested_price', value: 45.00 }
```

Provider selection is controlled by `AI_PROVIDER` env var (default: `claude`).
Each provider module is responsible for its own SDK/API calls and streaming.

---

## eBay Integration

### Connection Flow
1. User visits `/settings` → "Connect eBay Account".
2. Server redirects to eBay OAuth consent screen (`/ebay/auth`).
3. eBay redirects back to `/ebay/callback` with auth code.
4. Server exchanges code for access + refresh tokens, encrypts, stores in `ebay_connections`.
5. Settings page shows connected status and scopes.

### Publish Flow
1. User hits "Publish to eBay" on `/items/:id`.
2. `POST /ebay/publish/:id` — server reads draft, builds eBay `createOrReplaceInventoryItem` + `publishOffer` payload.
3. On success: `items.status = 'published'`, `items.ebay_listing_id` stored.
4. On failure: `items.status = 'failed'`, error surfaced via SSE signal.

### eBay API Endpoints Used
- `POST /sell/inventory/v1/inventory_item/{sku}` — create inventory item
- `POST /sell/inventory/v1/offer` — create offer
- `POST /sell/inventory/v1/offer/{offerId}/publish` — publish offer

---

## Frontend Architecture

### Web Components

| Component | Purpose |
|---|---|
| `<up-camera>` | Camera capture + file upload with preview |
| `<up-draft-field>` | Editable field that streams in AI-generated content |
| `<up-item-card>` | Dashboard draft card |
| `<up-publish-btn>` | Publish button with loading/result states |
| `<up-toast>` | Notification banner |
| `<up-modal>` | Generic modal shell |

### Datastar Signals (per draft page)

```js
{
  title: '',
  description: '',
  item_specifics: {},
  category_id: '',
  condition: '',
  suggested_price: null,
  final_price: null,
  generating: false,
  publishing: false,
  error: null,
  saved: false
}
```

### CSS Architecture

- **Custom properties** on `:root` for Kelp UI token overrides
- **`@layer`** ordering: `reset, base, kelp, components, utilities`
- **Container queries** for item card responsive layout
- No build step — plain `.css` files loaded via `<link>`

---

## PWA & Offline

### Manifest (`/manifest.webmanifest`)
```json
{
  "name": "UpList",
  "short_name": "UpList",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "icons": [...]
}
```

### Service Worker Strategy

| Resource | Strategy |
|---|---|
| App shell (HTML, CSS, JS) | Cache-first (versioned cache) |
| API GET requests | Network-first, fallback to cache |
| Images (item photos) | Cache-first |
| SSE / AI generation | Network-only (no offline equivalent) |
| eBay publish | Network-only |

### Offline Write (Background Sync)

1. User creates/edits a draft offline.
2. Draft saved to IndexedDB (`pending-sync` store) with a local nanoid.
3. `BackgroundSync` tag `'up-list-sync'` registered.
4. When online, service worker fires `sync` event → `POST /sync/batch` with pending items.
5. Server upserts items, returns canonical IDs; IndexedDB cleared.

---

## Auth

### Email / Password
- `POST /auth/register` — validate, bcrypt hash (12 rounds), insert `users`, create session.
- `POST /auth/login` — lookup user, compare hash, create session cookie (HttpOnly, Secure, SameSite=Strict).

### OAuth (Google, GitHub)
- Standard authorization code flow.
- On callback: find or create `users` row, link `oauth_accounts`, create session.
- Library: hand-rolled (no passport) using provider-specific token exchange.

### Session
- Token stored as `Set-Cookie: session=<opaque-token>; HttpOnly; Secure; SameSite=Strict`
- Server-side lookup in `sessions` table on each request.
- 30-day expiry, sliding renewal.

---

## Environment Variables

```
# Server
PORT=3000
DATABASE_URL=                  # Turso libSQL URL
DATABASE_AUTH_TOKEN=           # Turso auth token
SESSION_SECRET=                # 32+ byte random string
ENCRYPTION_KEY=                # 32 byte key for token encryption at rest

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# AI
AI_PROVIDER=claude             # 'claude' | 'openai'
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# eBay
EBAY_APP_ID=
EBAY_CERT_ID=
EBAY_DEV_ID=
EBAY_REDIRECT_URI=
EBAY_SANDBOX=false             # 'true' for sandbox environment
```

---

## Project Structure

```
up-list/
  public/
    app.js              -- top-level ES module, registers components
    components/         -- Web Component definitions
    css/
      reset.css
      base.css
      components.css
    sw.js               -- Service Worker
    manifest.webmanifest
  server/               -- (see Server Architecture above)
  views/                -- Eta templates
    layout.eta
    pages/
      landing.eta
      dashboard.eta
      item-new.eta
      item-edit.eta
      settings.eta
      auth/
        login.eta
        register.eta
  migrations/           -- numbered SQL files
  .env.example
  package.json
  SPEC.md
  README.md
```

---

## Key Constraints & Decisions

- **No bundler** — ES modules served directly; Datastar and Kelp loaded via CDN or vendored.
- **No ORM** — raw libSQL queries; migrations are plain `.sql` files run in order.
- **SSE not WebSocket** — Datastar's model fits SSE; simpler server, no upgrade handshake.
- **Images stored as URLs** — upload to object storage (e.g. Cloudflare R2 or S3-compatible); blob fallback in IndexedDB for offline capture only.
- **eBay sandbox first** — `EBAY_SANDBOX=true` in development to avoid live listing side-effects.
- **Provider-agnostic AI** — adapter pattern means swapping models is a one-line env change.
- **Kelp UI as base** — override tokens via CSS custom properties; do not fork Kelp source.
