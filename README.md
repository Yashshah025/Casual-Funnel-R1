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

### 1. Normalized Heatmap Coordinate System
- **Problem**: Projecting clicks based on `Math.max(...clicks)` causes coordinate positions to drift as new clicks arrive, and document scroll coordinates (`pageX`/`pageY`) do not map directly to a static canvas layout.
- **Solution**:
  - `tracker.js` records raw pixel coordinates along with normalized percentage positions:
    $$\text{pct\_x} = \frac{\text{pageX}}{\text{documentWidth}} \times 100, \quad \text{pct\_y} = \frac{\text{pageY}}{\text{documentHeight}} \times 100$$
  - `HeatmapCanvas.jsx` renders clicks deterministically using these normalized percentages across a fixed layout aspect ratio. A click at (50%, 30%) remains at exactly (50%, 30%) regardless of subsequent clicks elsewhere.
  - Viewport and document dimensions at click time are persisted for future overlay reconstruction.

### 2. Materialized Session Summaries ($O(\log N)$ Pagination)
- **Problem**: Performing a full collection `$group` by `session_id` on every paginated dashboard request forces MongoDB to scan and aggregate all events before applying `$skip` and `$limit`.
- **Solution**:
  - Maintained a dedicated `sessions` collection using atomic MongoDB operators (`$inc`, `$min`, `$max`, `$addToSet`) during event ingestion (`upsert_session_summary`).
  - Session list pagination queries the indexed `sessions` collection with `{ last_active: -1 }`, eliminating runtime full-collection aggregations.
  - Startup synchronizer (`sync_materialized_sessions_if_needed`) automatically initializes session summaries if the collection is empty.

### 3. True Client-Side Batching with Failure Recovery
- **Problem**: Flushing a queue via individual HTTP requests creates excessive network and server connection overhead; clearing the queue before dispatch risks data loss on network failure.
- **Solution**:
  - `tracker.js` dispatches queued events as a single array payload to `POST /api/events/batch` (or `POST /api/events`).
  - If a network request fails (e.g. temporary offline state), unconfirmed events are re-enqueued (capped to prevent memory leaks).
  - During page unload, `navigator.sendBeacon` transmits the JSON batch payload as an `ArrayBufferView` to bypass non-blocking teardown restrictions.
  - Replaced direct `localStorage` access with a safe wrapper that falls back to in-memory session IDs when cookies/storage are blocked by browser privacy policies.

### 4. Strict Server-Side Validation
`backend/services/ingestion_service.py` enforces data integrity before storage:
- **Timestamp Validation**: Requires valid ISO 8601 timestamps; rejects malformed inputs instead of silently replacing them with `now()`.
- **Clock Skew Checks**: Rejects events with timestamps skewed > 10 minutes into the future or > 60 days in the past.
- **Dual Timestamps**: Stores both client-reported `timestamp` and server-verified `server_ingested_at`.
- **Coordinate Checks**: Rejects negative, non-numeric, `NaN`, or infinite coordinates for click events.
- **URL Normalization**: Strips fragments (`#...`) and trailing slashes so URL analytics group reliably.

### 5. Security & Deployment Model
- **Dashboard Authorization**: Optional `ADMIN_API_KEY` can be enforced via `REQUIRE_DASHBOARD_AUTH=true`. The API validates `X-API-Key` headers on protected analytics routes.
- **CORS Separation**: Tracking ingestion accepts public cross-origin beacons (`*`), while analytics endpoints restrict origins based on `ALLOWED_DASHBOARD_ORIGINS`.
- **Production WSGI**: Added `backend/wsgi.py` for deployment under WSGI servers (Waitress on Windows, Gunicorn on Linux).
- **Rate Limiting**: `Flask-Limiter` in-memory storage protects local endpoints; production deployments can switch to Redis via `RATELIMIT_STORAGE_URI`.

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
| `POST` | `/api/events` | Ingest single event or batch array | No |
| `POST` | `/api/events/batch` | Bulk event ingestion | No |
| `GET` | `/api/health` | Service health & MongoDB ping | No |
| `GET` | `/api/overview` | Aggregated dashboard KPI metrics | Optional / Configurable |
| `GET` | `/api/sessions` | Paginated materialized session summaries | Optional / Configurable |
| `GET` | `/api/sessions/:id` | Full chronological event journey for a session | Optional / Configurable |
| `GET` | `/api/analytics/clicks` | Filtered click points with normalized coordinates | Optional / Configurable |
| `GET` | `/api/analytics/urls` | Distinct tracked URLs for heatmap dropdown | Optional / Configurable |
