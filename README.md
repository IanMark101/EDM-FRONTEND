# EDM-FRONTEND

The Next.js interface for the CareRecord clinic workspace.

## Local setup

Use Node.js 22.13 or newer.

Clone [EDM-BACKEND](https://github.com/IanMark101/EDM-BACKEND) and start its API on port 3001. From this checkout, run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `frontend/.env.example` to `frontend/.env.local` to configure the backend address. Set `CLINIC_API_ORIGIN` there and restart the frontend after editing it. Use the same browser hostname when signing in and opening the workspace.

Run `npm run build` for the production build or `npm run typecheck` to check types. Third-party notices are in [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

The `shared/` folder contains the types and rules used by both applications. Keep it synchronized with the other CareRecord repository when updating it.
