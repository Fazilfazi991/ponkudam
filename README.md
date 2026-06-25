# Ponkudam Gold & Diamonds

Static storefront and admin dashboard with a Supabase-backed API.

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Confirm these public storage buckets exist:
   - `product-images`
   - `category-images`
   - `site-assets`
4. Add these environment variables locally and in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Install dependencies:

```bash
npm install
```

6. Migrate the backup JSON data into Supabase:

```bash
npm run migrate:supabase
```

To import all existing website products, including static diamond product data and local product images:

```bash
npm run import:products
```

The importer scans `data/db.json`, `products.js`, `diamond-products.js`, and local image folders, uploads product images to the `product-images` bucket, then upserts categories and products.

7. Start locally:

```bash
npm start
```

8. Open `/admin` and sign in.

## Admin Login

The migration script creates users from `data/db.json`. The default local seed is:

- Username: `admin`
- Password: `admin123`

Change the default admin password before production use.

## Notes

- `data/db.json` is kept as a backup and local fallback.
- Browser code calls `/api/...`; admin writes use the server-side Supabase service-role client.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend JavaScript.
- Product featured/gallery uploads go to `product-images`.
- Category images should use `category-images`.
- Logo, BIS, and HUID assets should use `site-assets`.
