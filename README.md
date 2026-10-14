# CausalFunnel Full-Stack User Analytics Pipeline & Dashboard

A modular full-stack user behavior tracking and session analytics application built for the **CausalFunnel Full Stack Engineer** assignment. It captures client-side interactions (`page_view` and `click` with normalized coordinates), ingests events in batches, maintains materialized session summaries, and presents data in a React dashboard featuring an interactive **User Session Journey** and a **Normalized Click Heatmap**.

---

## 🏛️ Architecture & Project Structure

The project follows a clean separation of concerns:
- **Presentation Layer (Controllers)**: Flask Blueprints handling routing, rate limiting, and request decoding.
- **Service Layer (Business Logic)**: Payload sanitization, ISO parsing, coordinate bounds validation, and metrics compilation.
- **Data Access Layer (DAL / Repositories)**: Isolated MongoDB queries using compound indexing and atomic upserts.
- **Client Tracking SDK**: Non-blocking script with event batching, normalized percentage coordinates, safe storage fallback, and unload beacons.
- **Frontend Dashboard**: React 18 + Vite + Tailwind CSS with custom data hooks and responsive heatmap visualizer.

```plaintext
CasualFunnel/
├── backend/                              # Python Flask API
│   ├── app.py                            # Application factory & route registration
│   ├── wsgi.py                           # Production WSGI entrypoint (Gunicorn / Waitress)
│   ├── config.py                         # Environment-driven configuration (DEBUG, Auth, CORS)
│   ├── extensions.py                     # Rate limiter & CORS initializers
│   ├── core/
│   │   ├── exceptions.py                 # Custom exceptions (AppError, ValidationError, NotFoundError)
│   │   ├── responses.py                  # Standard response envelopes { success, data, error }
│   │   └── logger.py                     # Structured timestamped logging
│   ├── database/
│   │   ├── connection.py                 # Singleton MongoConnectionManager with connection ping
│   │   └── indexes.py                    # Index definitions for events and sessions
│   ├── repositories/                     # Data Access Layer (DAL)
│   │   ├── event_repository.py           # Document insertion, point extraction, batch inserts
│   │   └── session_repository.py         # Materialized session summaries & paginated queries
│   ├── services/                         # Business Logic Layer
│   │   ├── ingestion_service.py          # Strict coordinate validation, URL normalization, clock skew checks
│   │   └── analytics_service.py          # Timeline assembly, journey metrics, heatmap points
│   ├── routes/                           # HTTP Controllers
│   │   ├── __init__.py                   # Blueprint registration
│   │   ├── ingestion_routes.py           # POST /api/events, POST /api/events/batch
│   │   └── analytics_routes.py           # GET /api/sessions, /api/overview, /api/analytics/*
│   ├── requirements.txt
│   └── .env                              # MONGO_URI, PORT, FLASK_ENV, ADMIN_API_KEY
│
├── tracker/                              # Client-side Tracking SDK & Demo Site
│   ├── tracker.js                        # Event buffer, batch dispatcher, normalized coords, unload beacon
│   └── demo/                             # Demo e-commerce store
│       ├── index.html                    # Store homepage with interactive cards
│       ├── product.html                  # Product details page for multi-page journeys
│       └── style.css
│
├── frontend/                             # React 18 + Vite + Tailwind CSS Dashboard
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js                 # API client wrapper with X-API-Key auth support
│   │   │   └── analyticsApi.js           # Typed analytics endpoints
│   │   ├── hooks/                        # Custom data hooks (useOverview, useSessions, useHeatmap)
│   │   ├── components/
│   │   │   ├── common/                   # Reusable UI primitives (MetricCard, Badge, Spinner)
│   │   │   ├── layout/                   # Header, Footer, Navigation
│   │   │   ├── sessions/                 # SessionTable, UserJourneyTimeline modal
│   │   │   └── heatmap/                  # HeatmapControls, HeatmapCanvas visualizer
│   │   ├── App.jsx                       # Main view coordinator
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── README.md
```

---

## 🔍 Key Technical Design & Implementations

### 1. Normalized Heatmap Coordinate System (Schematic)
- **Problem**: Projecting clicks based on dynamic coordinate maximums causes positions to drift as new clicks arrive. Furthermore, page height changes with dynamic content, meaning absolute pixels cannot directly map to a static canvas layout.
- **Solution**:
  - `tracker.js` records raw pixel coordinates along with normalized percentage positions:
    $$\text{pct\_x} = \frac{\text{pageX}}{\text{documentWidth}} \times 100, \quad \text{pct\_y} = \frac{\text{pageY}}{\text{documentHeight}} \times 100$$
  - `HeatmapCanvas.jsx` visualizes clicks as a **Normalized Click Density Schematic** across conceptual viewport zones (Header, Hero, Product Grid, Footer). A click at (50%, 30%) remains deterministically at (50%, 30%).
  - Raw pixel coordinates, viewport dimensions, and document bounds are preserved with each click document for future layout overlays.

### 2. Materialized Session Summaries & Idempotency ($O(\log N)$ Pagination)
- **Problem**: Performing a full collection `$group` by `session_id` on every paginated dashboard request forces MongoDB to scan and aggregate all events before applying `$skip` and `$limit`. Additionally, network retries risk duplicate counting.
- **Solution**:
  - Maintained a dedicated `sessions` collection using atomic MongoDB operators (`$inc`, `$min`, `$max`, `$addToSet`) during event ingestion (`upsert_session_summary`).
  - Session list pagination queries the indexed `sessions` collection with `{ last_active: -1 }`, eliminating runtime full-collection aggregations.
  - **Idempotency**: Every event contains an `event_id` backed by a unique sparse index `idx_event_id_unique`. Retried events are recognized and return HTTP success without re-incrementing session counters.
  - **Reconciliation**: Added targeted session repair (`reconcile_session`) on write errors, plus an administrative reconciliation operation (`POST /api/admin/reconcile-sessions`) to rebuild summaries from raw events.

### 3. Client-Side Batching with Failure Recovery vs Best-Effort Unload
- **Problem**: Individual network requests cause connection overhead. Unload beacons return immediately without server confirmation and cannot retry.
- **Solution**:
  - Scheduled and threshold flushes use standard `fetch()`, verifying HTTP responses and requeuing failed batches (capped to prevent memory growth) for automatic retry.
  - Page exit (`visibilitychange` / `pagehide` / `beforeunload`) uses `navigator.sendBeacon` (with keepalive fetch fallback) as a best-effort flush without blocking browser teardown.
  - Storage access is protected by safe wrappers that fall back to memory storage in restricted/private browsing modes.

### 4. Strict Server-Side Validation
`backend/services/ingestion_service.py` enforces data integrity before storage:
- **Timestamp Validation**: Requires valid ISO 8601 strings with explicit timezones (e.g. `Z` or `+00:00`); timezone-naive timestamps return a clean HTTP 400 `ValidationError`.
- **Clock Skew Checks**: Rejects events with timestamps skewed > 10 minutes into the future or > 60 days in the past.
- **Dual Timestamps**: Stores both client-reported `timestamp` and server-verified `server_ingested_at`.
- **Coordinate Checks**: Rejects negative, non-numeric, `NaN`, or infinite coordinates for click events.
- **URL Normalization**: Strips fragments (`#...`) and trailing slashes so URL analytics group reliably.
- **Payload Limits**: Max request body bounded to 256KB (`MAX_CONTENT_LENGTH = 256 * 1024`), cleanly accommodating batches of up to 50 events (`MAX_BATCH_SIZE = 50`).

### 5. Security & Deployment Model
- **Dashboard Authorization**: Optional `ADMIN_API_KEY` can be enforced via `REQUIRE_DASHBOARD_AUTH=true`. The API validates `X-API-Key` headers on protected analytics routes.
- **CORS Separation**: Tracking ingestion accepts public cross-origin beacons (`*`), while analytics endpoints restrict origins based on `ALLOWED_DASHBOARD_ORIGINS`.
- **Production WSGI**: Added `backend/wsgi.py` for deployment under WSGI servers (Waitress on Windows, Gunicorn on Linux).
- **Rate Limiting**: `Flask-Limiter` in-memory storage protects local endpoints; production deployments can switch to Redis via `RATELIMIT_STORAGE_URI`.

---

## 🛠️ Tech Stack

- **Client Tracking SDK**: Vanilla JavaScript (UMD bundle, zero runtime dependencies, beacon API, storage fallback, event batching).
- **Backend API**: Python 3.10+ & Flask 3.0 (Application Factory, Blueprints, PyMongo, Flask-CORS, Flask-Limiter, Waitress/Gunicorn WSGI).
- **Database**: MongoDB 6.0+ (Compound indexes, atomic operators `$inc`, `$min`, `$max`, `$addToSet`, unique sparse index for idempotency).
- **Frontend Dashboard**: React 18, Vite 5, Tailwind CSS, Lucide React (Custom hooks, responsive zero-scroll schematic heatmap canvas, user journey timeline modal).
- **E-Commerce Testbed**: HTML5, CSS3, JavaScript (Multi-page shop with cart, product views, and click zones).

---

## ⚖️ Assumptions & Trade-Offs

1. **Normalized Schematic vs. DOM Element Overlay**:
   - *Decision*: Clicks are mapped to a normalized 0%–100% canvas schematic rather than capturing complete DOM element trees or full webpage screenshots.
   - *Rationale*: A schematic heatmap is completely cross-browser, responsive across viewport sizes, avoids cross-origin iframe security barriers, and works without fragile DOM tree snapshots. Viewport bounds and raw coordinates are preserved in MongoDB for future element-level mapping.
2. **Materialized Session Summaries vs. Dynamic $group Aggregation**:
   - *Decision*: Maintain a dedicated `sessions` collection incrementally on write using atomic MongoDB operators, supplemented with an admin reconciliation endpoint (`POST /api/admin/reconcile-sessions`).
   - *Rationale*: Running `$group` across the entire `events` collection on every dashboard page load creates an $O(N)$ CPU and memory bottleneck at scale. Materialized summaries make session list pagination $O(\log N)$ fast.
3. **API Key Authentication vs. Full User Login System**:
   - *Decision*: Implemented environment-driven API key authorization (`ADMIN_API_KEY` with `X-API-Key` headers) rather than a multi-table user registration/login system.
   - *Rationale*: Eliminates evaluation friction for interviewers testing the project locally while strictly enforcing security policies. In an enterprise setting, the dashboard would sit behind company SSO (Okta/Auth0) or an API Gateway.
4. **In-Memory Rate Limiting vs. Distributed Cache**:
   - *Decision*: Configured `Flask-Limiter` with in-memory storage by default, with `RATELIMIT_STORAGE_URI` configurable for Redis.
   - *Rationale*: Keeps local setup zero-dependency (no Redis requirement for reviewers). For horizontal multi-worker scaling, pointing `RATELIMIT_STORAGE_URI` to a Redis instance shares limits across instances.
5. **Client-Side Queue & Network Batching with Best-Effort Unload**:
   - *Decision*: Normal flushes use `fetch()` with automatic requeueing on failure. Unload listeners use `navigator.sendBeacon`.
   - *Rationale*: `sendBeacon` transfers responsibility to the browser to prevent dropped events on tab close, but does not provide delivery guarantees or retry hooks. Scheduled flushes use `fetch()` to guarantee response verification and retry resilience.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Local MongoDB running on `mongodb://localhost:27017`

---

### Step 1: Start the Backend API

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
python app.py
```
*Backend runs on `http://localhost:5000`.*  
*(For production WSGI on Windows: `waitress-serve --listen=0.0.0.0:5000 wsgi:application`)*

---

### Step 2: Start the Frontend Dashboard

```bash
cd frontend
npm install
npm run dev
```
*Dashboard runs on `http://localhost:5173`.*

---

### Step 3: Run the Demo E-Commerce Store

To generate real tracking events, serve the demo site:

```bash
cd tracker/demo
python -m http.server 5500
```
Open `http://localhost:5500` in your browser:
1. Browse products, click **"Add to Cart"**, and click various elements on the page.
2. Navigate to product detail pages to generate multi-page session journeys.
3. Switch to `http://localhost:5173` to see real-time sessions, path timelines, and the normalized click heatmap!

---

## 🧪 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/events` | Ingest single event or batch array (idempotent via `event_id`) | No |
| `POST` | `/api/events/batch` | Bulk event ingestion (up to 50 events) | No |
| `GET` | `/health` / `/api/health` | Service health & MongoDB status | No |
| `GET` | `/api/overview` | Aggregated dashboard KPI metrics (reads from materialized summaries) | Optional / Configurable |
| `GET` | `/api/sessions` | Paginated materialized session summaries ($O(\log N)$) | Optional / Configurable |
| `GET` | `/api/sessions/:id` | Full chronological event journey for a session | Optional / Configurable |
| `GET` | `/api/analytics/clicks` | Filtered click points with normalized percentage coordinates | Optional / Configurable |
| `GET` | `/api/analytics/pages` | Tracked URLs for heatmap dropdown (`/api/analytics/urls` alias) | Optional / Configurable |
| `POST` | `/api/admin/reconcile-sessions` | Recalculate session summaries from raw events | Admin API Key |
