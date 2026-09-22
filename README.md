# n8n-nodes-usetix

Connect [Usetix](https://www.usetix.io) ticketing to n8n. Manage events, look up
orders, add guest parties, create promo codes, and start workflows from signed
order, event, check-in and voucher notifications.

## Install

In a self-hosted n8n instance, open **Settings → Community Nodes → Install** and
enter `n8n-nodes-usetix`. Version 1.0.1 is published on npm and includes a
GitHub Actions provenance statement. Availability in n8n Cloud requires n8n
verification. Automated review has passed; manual review still needs a short
demo video. Installing the package does not by itself mean the node is verified.

## Credentials

In Usetix, open **Settings → API Tokens** and create a token. Paste it into the
**Usetix API** credential in n8n. A read token supports lookup/list operations;
write access is required for changes and webhook subscriptions.

OAuth2 is available for instances with a registered Usetix OAuth client. Register
the exact callback URL shown by n8n, then enter the client ID and secret in the
**Usetix OAuth2 API** credential. Connect and select the Usetix account. PKCE is
required. Client secrets must stay in the encrypted credential store.

External co-organizers use personal tokens, or OAuth with their own login. They
can work only with their assigned events. Account-wide order lookup, venue and
voucher operations require an owner or manager with the corresponding access.

## Nodes

**Usetix** supports event creation, lookup, listing, updates, publication and
unpublication; order lookup; guest ticket listing; guest party creation; and
promo code creation. Select an event to load its ticket types, then choose
available seats or a standing area when needed. Usetix reserves the inventory
atomically. A stale seat selection produces an actionable error.

**Usetix Trigger** supports all sixteen Usetix webhook event types. Select one or
more, optionally filter by event, then activate the workflow. The node creates
its own subscription and removes it when deactivated. Use separate triggers for
account-wide voucher notifications and notifications filtered by event.

Notifications can arrive more than once. Use `id` with n8n's **Remove Duplicates**
node or a unique key in the destination. Map that stable ID into **Unique Request
Key** for Usetix create actions. Repeating the same key and input returns the same
result for seven days. Changed input or permissions returns HTTP 409.

Callbacks are authenticated using an API read of the original signed delivery.
The incoming body is never used as trusted workflow data, and signing secrets are
not stored in workflows. Failed delivery lookups and API failures stay visible in
n8n. Use an error workflow for operational alerts.

See the [Usetix API documentation](https://www.usetix.io/docs/api/) for payloads,
permissions and rate-limit behavior. For other API operations, use n8n's HTTP
Request node with the Usetix API credential.

## Develop and publish

```sh
npm ci
npm run build
npm run lint
npm test
```

This directory is the complete public package source. The parent Usetix
application is private and must not be included in its repository or npm tarball.
Publish from `.github/workflows/publish.yml`, which signs npm provenance. Set the
GitHub `npm` environment and either a narrowly scoped `NPM_TOKEN` secret for the
first release or an npm trusted publisher for this repository and workflow.
The token belongs in GitHub Actions secrets, never in this repository.

The package is submitted in the [n8n Creator Portal](https://creators.n8n.io/nodes/n8n-nodes-usetix/integration).
Automated review passed on 2026-09-22. Manual review is waiting for a demo video
of install, credential test, and a common action.

## License

MIT
