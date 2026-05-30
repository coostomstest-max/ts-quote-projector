# ts-quote-projector

A TypeScript service for projecting currency exchange rates based on historical data from the Argentine public data API.

## Overview

This project fetches historical exchange rate data from the [BCRA/datos.gob.ar API](https://apis.datos.gob.ar/series/api/series/?ids=168.1_T_CAMBIOR_D_0_0_26) and uses mathematical projections to estimate future exchange rates based on daily trend analysis.

## Project Structure

```
ts-quote-projector/
├── app/
│   └── index.ts              # Application entry point
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

### Development

Run the application in development mode with hot reload:

```bash
npm run dev
```

### Build

Compile TypeScript to JavaScript:

```bash
npm run tsc
```

### Running in Production

After building, start the production server:

```bash
npm start
```

## Usage

The main service is `ExchangePojectorService` which provides methods for:

1. **obtenerCotizacionesUltimoMes()** - Fetches exchange rate data from the last 30 days
2. **calcularTasaDiariaPromedio()** - Calculates average daily exchange rate using logarithmic returns
3. **proyectarCotizacion(fechaFutura)** - Projects the exchange rate for a given future date

### Example

```typescript
import { ExchangePojectorService } from "../src/service/exchProjector.basic.sercice";

const projector = new ExchangePojectorService();

const nDays = 1;
const today = new Date(new Date(Date.now() + 86400000 * nDays)).toISOString().substring(0, 10);
projector.proyectarCotizacion(today).then(res => {
    console.log("Proyección para ", today, ": ", res);
}).catch(err => {
    console.error("Error en proyección:", err);
});
```

## Data Source

The service uses the Argentine public data API for exchange rate information:
- **API Base URL**: `https://apis.datos.gob.ar/series/api/series/`
- **Series ID**: `168.1_T_CAMBIOR_D_0_0_26`

## How Projection Works

1. Fetches the last 30 days of exchange rate data
2. Calculates daily logarithmic returns for both buy and sell rates
3. Computes the geometric mean of daily returns to estimate average daily rate
4. Applies compound growth formula to project future rates

## License

ISC
