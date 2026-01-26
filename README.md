# Networth Pro (V2) - Quick Start

## 1. Backend (FastAPI)
**Terminal 1:**
```bash
# From the project root (networth-app)
cd next-gen/backend
.venv/bin/uvicorn main:app --reload
```
*   API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## 2. Frontend (Next.js)
**Terminal 2:**
```bash
# From the project root (networth-app)
cd next-gen/frontend
npm run dev
```
*   App: [http://localhost:3000](http://localhost:3000)

## Common Issues
*   **Path Errors**: Ensure you are in the correct directory. If you are already in `backend`, you must `cd ../frontend` to switch.
*   **Port Conflicts**: Ensure nothing is running on port 3000 or 8000.
