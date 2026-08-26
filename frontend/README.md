# IndusGate AI Frontend

React + TypeScript + Vite frontend for the IndusGate AI Sentinel prototype.

For full setup, architecture, demo credentials, backend configuration, and the walkthrough flow, see the root [README.md](../README.md).

## Local Development

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

The frontend expects the backend at `http://127.0.0.1:8000` unless `VITE_API_BASE_URL` is configured.
