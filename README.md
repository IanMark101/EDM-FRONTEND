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

Run `npm test` to check API cookie forwarding and failure handling without connecting to the backend. The frontend adds the Secure attribute to cookies returned over HTTPS, including when its API connection uses local HTTP.

## Set service prices before new billing

Sign in as the account manager and open **Service prices**. Add the clinic-approved consultation price and each laboratory test price. Use the same test names that doctors request. Managers can edit or disable a price; changes require a reason and keep an activity record.

Billing's **Prepare bill** screen lists completed services with their approved prices, source record numbers, responsible staff and price-setting staff. Billing selects services without entering an arbitrary amount. Missing prices identify the account manager as the person to contact. Approved later services can be added to the same bill with a reason; already-billed services are excluded.

Saved bill lines show their service and price sources. Earlier bills keep their amounts and payment controls, with a clear label where historical source references were not recorded. Updating the price list does not recalculate saved charges.

Use the updated backend with this frontend. No database migration or automatic price seeding is needed. `npm test` also renders the actual billing components to check approved-price display, missing-price blocking and compatibility with earlier invoices.

## Refresh and save recovery

The browser retries an interrupted read or HTTP 503 once within its original request deadline. It does not automatically repeat saves, bill creation or payments. An uncertain save asks staff to refresh and check the records first.

A confirmed service-price save updates the visible price list immediately. A later failed workspace refresh shows a separate warning while preserving the confirmed price, and the normal refresh controls can recover the list. Tests also cover temporary read failures, persistent outages, uncertain saves and request timeouts.

The `shared/` folder contains the types and rules used by both applications. Keep it synchronized with the other CareRecord repository when updating it.
