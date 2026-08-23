# Codex

Codex is a client-side semantic explorer for quotations and religious texts. It is a Next.js 14 Pages Router application hosted on Cloudflare Pages.

## Architecture

The deployed site has no application database or search API. Search data is generated ahead of time and committed under `public/`:

- `*-cohere.json` contains display metadata.
- `*-embeddings-int8*.bin` contains 1,024-dimensional, quantized embeddings in the same row order as the metadata.
- Bible embeddings are split into multiple files to remain below Cloudflare Pages' per-file size limit.
- `cloud-points.json` contains compact two-dimensional coordinates and semantic-neighbor links for the WebGL cloud.
- `cloud-metadata.json` contains the cloud's lazily loaded display text and source metadata.
- `cloud-projection-metrics.json` records the projection benchmark and generation settings.

The browser downloads an index when a collection is opened, performs similarity search locally, and caches downloaded metadata and embeddings in IndexedDB. Theme preference is stored in local storage. All files under `public/` should be treated as publicly downloadable.

## Development

The repository declares Yarn 4 as its package manager:

```sh
yarn install
yarn dev
```

Before deploying, run:

```sh
yarn lint
yarn build
```

Node 20 is required. AWS credentials are only needed when regenerating embeddings with the scripts under `scripts/`; they are not used by the website at runtime.

## Deployment

The site is a pure static Next.js export. Use the **Next.js (Static HTML Export)** preset in Cloudflare Pages with:

```text
Build command: yarn build
Build output directory: out
Root directory: /
```

Do not use `@cloudflare/next-on-pages`; the adapter is unnecessary for this client-side site. `.node-version` pins the Cloudflare build environment to the same Node 20 runtime declared in `package.json`.

The build also removes locally generated, unquantized embedding files from `out/`. They are not tracked by Git and are not used by the deployed browser application.

## Data generation

The TypeScript scripts under `scripts/` build, enrich, quantize, split, and project the search datasets. Generated metadata and binary embeddings must retain identical row ordering: item IDs are array offsets, not independent database identifiers.

Do not commit source credentials, unlicensed private datasets, or unquantized embeddings. Local `.env` files and source-data directories are ignored by Git.
