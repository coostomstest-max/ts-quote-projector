# ts-quote-projector

A TypeScript service for projecting currency exchange rates based on historical data from the Argentine public data API.

## Overview

This project fetches historical exchange rate data from the [BCRA/datos.gob.ar API](https://apis.datos.gob.ar/series/api/series/?ids=168.1_T_CAMBIOR_D_0_0_26) and uses mathematical projections to estimate future exchange rates based on daily trend analysis.

## Project Structure

```
ts-quote-projector/
├── app/
│   ├── index.ts              # CLI application entry point
│   └── server.ts             # API server (Express)
├── ui/
│   ├── index.html            # UI entry point
│   ├── styles.css            # Dark neon styles
│   ├── app.js                # UI logic (functions only)
│   └── api.js                # API client (fetch only)
├── src/
│   ├── infra/
│   │   └── datasets/
│   │       └── dolaritoAdjustment.json  # Rate adjustment data
│   └── service/
│       ├── exchProjector.basic.sercice.ts  # Core projection service
│       ├── rateAdjust.service.ts           # Rate adjustment logic
│       ├── regex.ts                        # Regular expressions
│       └── types.d.ts                      # TypeScript type definitions
├── package.json
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

```bash
npm install
```

## Running the Application

### 1. Start the API Server

```bash
npm run dev:server
```

The server will run on `http://localhost:3001` and exposes:
- `GET /api/cotizaciones` - List of historical exchange rates
- `GET /api/proyeccion?fecha=YYYY-MM-DD` - Projection for a future date

### 2. Start the UI (in another terminal)

```bash
npm run dev:ui
```

The UI will be available at `http://localhost:8080`

### 3. Run Both Together

```bash
npm run dev:all
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev:server` | Start the TypeScript API server |
| `npm run dev:ui` | Serve the UI on port 8080 |
| `npm run dev:all` | Run server and UI together |
| `npm run dev` | Run original CLI app |
| `npm run tsc` | Compile TypeScript |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         UI                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │
│  │index.html│ │styles.css│ │app.js  │                   │
│  └────┬────┘  └─────────┘  └────┬────┘                   │
│       │                         │                        │
│       └───────────┬─────────────┘                        │
│                   ▼                                      │
│            ┌──────────┐                                  │
│            │ api.js   │ (fetch only)                     │
│            └────┬─────┘                                  │
└─────────────────┼────────────────────────────────────────┘
                  │ HTTP
┌─────────────────▼────────────────────────────────────────┐
│              app/server.ts (TypeScript)                   │
│                   ┌───────────┐                          │
│                   │ Express   │                          │
│                   └─────┬─────┘                          │
└─────────────────────────┼────────────────────────────────┘
                          │ consumes
┌─────────────────────────▼────────────────────────────────┐
│                     /service                             │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │ ExchangeProjector│  │ RateAdjustService│               │
│  └────────┬────────┘  └─────────────────┘               │
└───────────┼──────────────────────────────────────────────┘
            │ fetches
┌───────────▼──────────────────────────────────────────────┐
│            BCRA / datos.gob.ar API                        │
└──────────────────────────────────────────────────────────┘
```

## Data Source

The service uses the Argentine public data API for exchange rate information:
- **API Base URL**: `https://apis.datos.gob.ar/series/api/series/`
- **Series ID**: `168.1_T_CAMBIOR_D_0_0_26`

## How Projection Works

1. Fetches the last 12 months of exchange rate data
2. Calculates daily logarithmic returns for both buy and sell rates
3. Computes the geometric mean of daily returns to estimate average daily rate
4. Applies compound growth formula to project future rates

## License

ISC
