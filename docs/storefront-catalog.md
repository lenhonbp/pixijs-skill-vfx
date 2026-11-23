# Storefront catalog

The public showcase has two related data sets:

- `showcase/public/packs/free/index.json` describes playable Free assets, their directions and download sizes. The runtime uses the loaded pack manifest for playback.
- `showcase/src/catalog-data.json` describes the products visitors can browse, their collections, release status, descriptions, contents, previews and store destinations. It is the public data boundary for approved product updates.

The catalog references existing pack IDs. It does not replace the delivery index or change the VFX container format.

## Current products

The catalog lists the existing **25 available Free effects** and three **Premium collections coming soon**: Kiếm Hiệp, Ngũ Hành and Ultimate Boss. Their planned themes come from the existing storefront. They do not currently have confirmed contents, prices, video previews or checkout links.

The Free/Premium tabs, collection selector and name search operate together. Search accepts English, Vietnamese and Vietnamese without accents. A Free effect keeps its existing `#<pack-id>` link. Premium collection details use `#product/<product-id>`.

| Product | Action shown |
|---|---|
| Free, `available` | Live PixiJS preview, current-direction desktop/mobile downloads, complete ZIP and integration code |
| Premium, `coming-soon` | Collection details, an optional video preview and a visible Coming soon state |
| Premium, `available` | Product details, an optional video preview and configured itch.io/Gumroad destinations |

Coming-soon records never show a purchase action, even if a store URL has been prepared. No price is displayed by this first catalog version. The linked store is the price and checkout destination for released Premium products.

## Update catalog metadata

The JSON document has `version: 1`, a `collections` array and a `products` array. Collection records provide `id`, `name`, `description`, a six-digit hex `accent` and `symbol`. Product records use the Free or Premium fields below. Only documented fields are accepted. Empty or unknown schema versions, duplicate collection/product IDs, duplicate Free pack references and malformed metadata fail validation.

`showcase/src/catalog.ts` validates the imported document through `validateCatalogData()`, and continues to export `collections` and `productDefinitions` for the view. `resolveCatalog(packs)` combines product descriptions from the catalog data with authoritative Free names, element and category from the delivery index. Catalog data never overrides playback metadata or file sizes. Product updates therefore change data rather than application TypeScript.

### Free products

A Free definition has `id`, `packId`, `collectionId`, `tier: 'free'`, `status: 'available'` and `description`. The initial records explicitly reference the 25 approved packs and belong to `free-collection`. Each description is stored with its product record, rather than in a separate source file.

An approved delivery updates the corresponding catalog data record and delivery-index entry together. A release containing one effect must preserve every unrelated product and index entry. Every pack in the Free index must have exactly one catalog reference. Missing references, duplicate references and unknown pack IDs fail validation rather than silently listing an unintended asset. Adding an approved new pack also requires updating the collection's documented membership and existing count checks as part of that release.

The ZIP's existing contents remain desktop/mobile `.vfxb` files, all available baked directions and its integration README. The npm runtime is installed separately. Selecting a direction still updates the individual download links, while the ZIP contains the full set of available directions.

### Premium products

A Premium definition uses the following fields:

| Field | Meaning |
|---|---|
| `id` | Stable, lowercase hyphenated identifier used in the product link |
| `collectionId` | An ID declared in `collections` |
| `tier` | `'premium'` |
| `status` | `'coming-soon'` or `'available'` |
| `name` | `{ en, vi }` with both display names present |
| `description` | Confirmed product description or clearly planned theme |
| `includes` | Confirmed list of what the buyer receives |
| `compatibility` | Confirmed formats, runtime versions or platform support |
| `preview` | Optional `{ type: 'video', src, poster? }` |
| `stores` | Optional list of `{ store: 'itch' \| 'gumroad', url }` |

To release one of the current collections, update its existing Premium record in `catalog-data.json`. Set `status: 'available'` only after supplying nonempty `includes`, nonempty `compatibility` and at least one real store product URL. Keep a single record for each product ID.

The store URL validator accepts HTTPS product pages on a creator's `*.itch.io` domain or a `/l/<product>` page on `gumroad.com` or a creator's `*.gumroad.com` domain. Credentials, fragments, placeholder destinations and unrelated hosts are rejected. This validates syntax and destination shape, not whether a store product is live. Open the actual destination and confirm the listing, price, license and delivered files before marking the product available.

Video sources may be HTTPS `.mp4`/`.webm` URLs or relative assets beneath `previews/`. A relative source such as `previews/collection-trailer.webm` maps to `showcase/public/previews/collection-trailer.webm`. Posters accept PNG, JPEG, WebP or AVIF. Only add media approved for public viewing. Missing previews display an honest preview-not-yet-available state.

Premium records do not accept `packId`, downloadable pack URLs or additional asset-delivery fields. A public preview is separate from the paid delivery. Put the complete paid package in the store's customer delivery area, not in the public repository, a public build or the Free pack index. Keep proprietary authoring and baking code in the private workspace. This catalog neither implements purchase authentication nor authorizes paid file downloads.

## Checks before push

```sh
npm run check:catalog
npm run check:docs
npm run typecheck
npm run build
npm run check:runtime
```

The focused catalog tests cover schema validation, membership, duplicate and missing references, release requirements, link/media validation and filtering. A data-only fixture update also verifies that a changed exported description and collection name reach the default catalog without editing TypeScript. The existing runtime smoke suite also invokes the catalog browser smoke: Free/Premium navigation, all eight cast directions and their download links, Premium deep links without pack downloads, playback cleanup, delayed-load transitions including return to the same Free effect, browser history and mobile browsing after scrolling the list. A test-only fixture exercises released-product purchase links and video controls, failure messaging and cleanup. Its synthetic listings are not imported into the production app, and all external fixture traffic is intercepted by the test.

Review the desktop and mobile views as well as automated results. Confirm that the Free stage, background selection, directions, ZIP downloads and integration code still work. CI screenshots can be produced through `VFX_CATALOG_SCREENSHOT` and `VFX_CATALOG_MOBILE_SCREENSHOT` for the new catalog states, alongside the existing showcase screenshot variables.
