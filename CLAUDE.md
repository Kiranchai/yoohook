# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YOOHOOK** — a real-time webhook inspection and testing tool. Users get a unique webhook URL, send HTTP requests to it, and inspect payloads live in the browser via WebSocket.

## Repository Structure

Two independent workspaces (no root package.json):

- `backend/` — Node.js/Express server (single-file: `index.js`, ~240 lines)
- `frontend/` — React 18 + TypeScript + Vite SPA

No shared code between them; they communicate via HTTP and WebSocket only.

## Development Commands

### Backend (`cd backend`)
- `npm start` — production (`node index.js`), runs on port 3000
- `npm run server` — development with auto-restart (`nodemon index.js`)

### Frontend (`cd frontend`)
- `npm run dev` — Vite dev server with HMR
- `npm run build` — type-check + bundle (`tsc -b && vite build`, outputs to `dist/`)
- `npm run lint` — ESLint
- `npm run preview` — preview production build locally

### Environment
Frontend requires `.env` with `VITE_SERVER_URL` and `VITE_WS_URL` (see `.env.example`).

## Architecture

### Backend (Express + ws)
Single `index.js` handles two concerns:
1. **WebSocket server** (`ws`, `noServer` mode) — clients connect at `ws://host/{webhookId}`. Connections stored in an in-memory `clients` object.
2. **HTTP catch-all** (`ALL /:webhookId*`) — receives any HTTP method, parses the body (JSON, form-data via multer, XML, raw, text), builds a payload, and forwards it to the connected WebSocket client. Also handles `POST /set-response/:webhookId/:method*` for custom response configuration stored in an in-memory `customResponses` object.

All backend state is ephemeral (in-memory); a restart clears everything.

### Frontend (React + shadcn/ui)
- **Routing:** React Router v6 — `/`, `/:webhookId`, `/:webhookId/:messageId`
- **State:** React Context (`MessagesProvider`) holds messages array; persisted to `localStorage`
- **UI:** shadcn/ui (Radix primitives + Tailwind CSS), dark theme, Monaco Editor for custom response forms
- **WebSocket:** `useWebSocket` hook connects to `ws://host/{webhookId}` with exponential backoff reconnection
- **Layout:** Resizable split-pane (`react-resizable-panels`) — message list (left) + message details (right)
- **Path alias:** `@/` maps to `./src/`

### Data Flow
External HTTP request → backend parses payload → sends via WebSocket → frontend `useWebSocket` hook receives → updates context + localStorage → UI renders message

### Custom Responses
Browser POSTs config to `/set-response/{webhookId}/{method}{path}` → backend stores in memory. Subsequent matching requests return the custom response instead of the default. Config also saved to `localStorage` for form repopulation.

## Key Conventions
- Backend uses ESM (`"type": "module"`)
- Frontend uses strict TypeScript
- No authentication — sessions identified by UUID in the URL
- No tests or CI currently exist
