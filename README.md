# CausalFunnel Production-Grade User Analytics Application

A high-performance, modular full-stack user behavior and session analytics application built for the **CausalFunnel Full Stack Engineer** assignment. It captures client-side user interactions (`page_view` and `click` with accurate document coordinates) and presents them in a dashboard featuring an interactive **User Session Journey** and a visual **Click Heatmap**.

---

## 🏛️ Production Architecture & Folder Structure

The project follows enterprise software engineering patterns:
- **Separation of Concerns**: Controllers (HTTP) $\rightarrow$ Services (Business Logic) $\rightarrow$ Repositories (Data Access Layer) $\rightarrow$ Database.
- **Client SDK**: Non-blocking UMD tracking script with in-memory queue, batching, and `beforeunload`/`visibilitychange` flush hooks.
- **React UI**: Custom Hook data layer (`useSessions`, `useHeatmap`, `useOverview`), reusable UI atomic components, and domain modules.

```plaintext
CasualFunnel/
├── backend/                              # Python Flask 3.0 API
│   ├── app.py                            # Application Factory (create_app)
│   ├── config.py                         # Typed settings & environment loader
│   ├── extensions.py                     # Singleton extensions (CORS, Limiter, Cache)
│   ├── core/
│   │   ├── exceptions.py                 # Custom error hierarchy (AppError, ValidationError, NotFoundError)
│   │   ├── responses.py                  # Standard response envelopes { success, data, error }
│   │   └── logger.py                     # Structured timestamped application logging
│   ├── database/
│   │   ├── connection.py                 # Singleton MongoConnectionManager with ping healthcheck
│   │   └── indexes.py                    # Index definitions for sub-second aggregations
│   ├── repositories/                     # Data Access Layer (DAL)
│   │   ├── event_repository.py           # Document insertion, point extraction, distinct queries
│   │   └── session_repository.py         # MongoDB aggregation pipelines
│   ├── services/                         # Business Logic Layer
│   │   ├── ingestion_service.py          # Payload sanitization, validation, ISO normalization
│   │   └── analytics_service.py          # Journey timeline assembly, metric math
│   ├── routes/                           # HTTP Presentation Layer (Controllers)
│   │   ├── __init__.py                   # Route blueprint registry
│   │   ├── ingestion_routes.py           # POST /api/events (rate-limited: 120/min)
│   │   └── analytics_routes.py           # GET /api/sessions, /api/overview, /api/analytics/*
│   ├── requirements.txt
│   └── .env                              # MONGO_URI, PORT
│
├── tracker/                              # Client-side SDK & Demo Site
│   ├── tracker.js                        # Production tracking SDK (Batching + Beacon/Fetch + UUID)
│   └── demo/                             # Multi-page test store
│       ├── index.html                    # Store homepage with clickable product cards
│       ├── product.html                  # Product details page for multi-page journey tests
│       └── style.css
│
├── frontend/                             # React 18 + Vite + Tailwind CSS Dashboard
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js                 # Fetch client wrapper with response unwrapping
│   │   │   └── analyticsApi.js           # Typed API service calls
│   │   ├── hooks/                        # Custom data hooks
│   │   │   ├── useOverview.js            # KPI metrics hook with auto-polling
│   │   │   ├── useSessions.js            # Sessions list hook
│   │   │   └── useHeatmap.js             # Tracked URLs and click coordinate points
│   │   ├── components/
│   │   │   ├── common/                   # Reusable UI primitives (MetricCard, Badge, Spinner)
│   │   │   ├── layout/                   # Header, Footer
│   │   │   ├── sessions/                 # SessionTable, UserJourneyTimeline modal
│   │   │   └── heatmap/                  # HeatmapControls, HeatmapCanvas visualizer
│   │   ├── App.jsx                       # View coordinator
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── README.md
```

---

## 🛡️ Security, Reliability & Performance

1. **Layered Rate Limiting (`Flask-Limiter`)**:
   - `POST /api/events`: Throttled to **120 requests/min per IP** to prevent bot flooding.
   - `GET /api/*`: Throttled to **60 requests/min** to protect MongoDB aggregation performance.
2. **Payload Protection**:
   - Maximum content length strictly capped at **16KB** (`MAX_CONTENT_LENGTH = 16 * 1024`).
   - Coordinate types enforced as numeric floats/integers before database write.
3. **Database Performance Indexing**:
   - Compound index `{ "session_id": 1, "timestamp": 1 }` allows $O(\log N)$ sorted journey retrieval with zero memory sort penalty.
   - Compound index `{ "url": 1, "event_type": 1 }` enables sub-second heatmap queries.
4. **Client-Side Event Batching**:
   - `tracker.js` buffers events in an in-memory queue and dispatches in batches or flushes immediately on `pagehide` / `beforeunload` using `navigator.sendBeacon`.
5. **Standardized Response Envelope**:
   - All responses follow `{ "success": true, "message": "...", "data": {...} }` or `{ "success": false, "error": {...} }`.

---

## 🚀 Running the Application

### 1. Backend (Flask)
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```
*Backend runs on `http://localhost:5000`.*

### 2. Frontend Dashboard (React)
```bash
cd frontend
npm install
npm run dev
```
*Dashboard runs on `http://localhost:5173`.*

### 3. Demo Webpage (Generate Test Data)
Serve `tracker/demo/index.html` via any static server or Python:
```bash
cd tracker/demo
python -m http.server 5500
```
Open `http://localhost:5500` in your browser. Click on products, buttons, and navigate to the product page. Then switch to `http://localhost:5173` to see real-time sessions and the visual click heatmap!
