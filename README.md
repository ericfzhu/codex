# Codex

Codex is a client-side semantic explorer for quotations and religious texts. It is a Next.js 14 Pages Router application hosted on Cloudflare Pages.

## Architecture

The deployed site has no application database or search API. Search data is generated ahead of time and committed under `public/`:

- `*-cohere.json` contains display metadata.
- `*-embeddings-int8*.bin` contains 1,024-dimensional, quantized embeddings in the same row order as the metadata.
- Bible embeddings are split into multiple files to remain below Cloudflare Pages' per-file size limit.
- `cloud-projections.json` contains the two-dimensional projection used by the WebGL cloud.

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

Cloudflare Pages currently supplies the deployment settings outside this repository. Keep the dashboard's build command and output directory documented here when they change so that the deployment remains reproducible.

The application currently produces standard Next.js build output. If the site is moved to a pure static-export configuration, add `output: 'export'` to `next.config.mjs` and deploy the generated `out/` directory after verifying routing on Cloudflare Pages.

## Data generation

The TypeScript scripts under `scripts/` build, enrich, quantize, split, and project the search datasets. Generated metadata and binary embeddings must retain identical row ordering: item IDs are array offsets, not independent database identifiers.

Do not commit source credentials, unlicensed private datasets, or unquantized embeddings. Local `.env` files and source-data directories are ignored by Git.
