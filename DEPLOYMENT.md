# Cloudflare Deployment Walkthrough — captures-gallery

This guide provides a comprehensive, end-to-end walkthrough for deploying the **captures-gallery** application to the Cloudflare developer platform.

---

## 1. Architecture Overview

`captures-gallery` runs entirely on Cloudflare serverless edge infrastructure:
- **Cloudflare Workers**: High-performance edge API router (`worker/index.ts`) handling metadata, search, and media delivery.
- **Workers Static Assets (`ASSETS`)**: Serves the compiled Vite + React 19 single-page application from `./dist`.
- **Cloudflare D1 (`DB`)**: Serverless distributed SQLite database storing collections, capture metadata, EXIF camera parameters, and gear tags.
- **Cloudflare R2 (`BUCKET`)**: Zero-egress-fee S3-compatible object storage for high-resolution photography and variants with immutable caching.
- **Cloudflare Access (Zero Trust)**: RS256 JWT-validated perimeter securing the curation studio (`/admin`) and mutation endpoints (`/api/admin/*`).

```
                              [ Cloudflare Edge ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
        [ Workers Assets ]                             [ Worker API ]
      (React 19 SPA /dist)                         (worker/index.ts)
                │                                             │
                │                           ┌─────────────────┴─────────────────┐
                │                           ▼                                   ▼
                │                  [ Cloudflare D1 ]                   [ Cloudflare R2 ]
                │                 captures-gallery-db               captures-gallery-media
                │                  (SQLite metadata)                  (Original images)
                │                                                               │
                └─────────────────────────┬─────────────────────────────────────┘
                                          ▼
                                   [ End User ]
```

---

## 2. Prerequisites

Before deploying, ensure you have:
1. **Node.js**: v18.0.0 or higher (`node -v`).
2. **Cloudflare Account**: [Sign up for Cloudflare](https://dash.cloudflare.com/sign-up).
3. **Cloudflare Plan**: Free tier supports Workers, D1, and R2 (ensure R2 is enabled on your account in the dashboard).
4. **Wrangler CLI**: Installed in this repository (`wrangler@^4.151.2`).

Authenticate Wrangler with your Cloudflare account:
```bash
npx wrangler login
```
Verify authentication:
```bash
npx wrangler whoami
```

---

## 3. Step-by-Step Deployment Walkthrough

### Step 1: Provision Cloudflare D1 Database

Create the distributed SQLite database:
```bash
npx wrangler d1 create captures-gallery-db
```

Wrangler will output configuration information similar to:
```text
✅ Successfully created DB 'captures-gallery-db'!

Add the following to your wrangler.jsonc to configure your Worker:
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "captures-gallery-db",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

Copy the generated `database_id` and update `wrangler.jsonc`:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "captures-gallery-db",
    "database_id": "YOUR_ACTUAL_D1_DATABASE_ID_HERE",
    "migrations_dir": "migrations"
  }
]
```

---

### Step 2: Provision Cloudflare R2 Storage Bucket

Create the R2 bucket for storing captures:
```bash
npx wrangler r2 bucket create captures-gallery-media
```

Verify that `wrangler.jsonc` contains the matching bucket binding:
```jsonc
"r2_buckets": [
  {
    "binding": "BUCKET",
    "bucket_name": "captures-gallery-media"
  }
]
```

---

### Step 3: Configure Cloudflare Access (Zero Trust) for Admin Studio

Cloudflare Access protects `/admin` and `/api/admin/*` using RS256 JWT validation against your Zero Trust team domain.

1. Navigate to the **[Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)**.
2. Go to **Access** > **Applications** > **Add an application** > **Self-hosted**.
3. Configure the application:
   - **Application name**: `Captures Gallery Admin`
   - **Application domain**: `gallery.yourdomain.com` (or your `*.workers.dev` subdomain)
   - **Path**: `/admin` and `/api/admin/*`
4. Add an **Access Policy**:
   - **Policy name**: `Admin Curation Access`
   - **Action**: `Allow`
   - **Rule**: Include `Emails` (enter your email address) or Identity Provider group.
5. In the application settings, note the following two values:
   - **Application Audience (AUD) Tag**: Found under **Overview** (a 64-character hex string).
   - **Team Domain**: Found under **Settings** > **Custom Pages** or your Zero Trust URL (e.g. `your-team.cloudflareaccess.com`).
6. Update `wrangler.jsonc` `vars` block (or set them via environment variables):
   ```jsonc
   "vars": {
     "ENVIRONMENT": "production",
     "CF_ACCESS_TEAM_DOMAIN": "your-team.cloudflareaccess.com",
     "CF_ACCESS_AUD": "your_64_character_hex_aud_tag"
   }
   ```

> [!NOTE]
> During local development (`ENVIRONMENT = "development"` or `localhost`), the authentication middleware automatically bypasses verification and injects a mock session (`dev@localhost`), so you can curate photos locally without internet access.

---

### Step 4: Apply Database Schema Migrations to Production

Execute the database migrations against the remote Cloudflare D1 instance:
```bash
npx wrangler d1 migrations apply DB --remote
```

This will run `migrations/0001_initial_schema.sql`, which:
- Creates the `collections` table.
- Creates the `captures` table with EXIF telemetry columns.
- Creates performance indexes (`idx_captures_collection`, `idx_captures_featured`, `idx_captures_captured_at`, `idx_captures_camera`).
- Seeds the initial curated collections (`architecture`, `street`, `minimalism`).

To verify that the tables were created remotely:
```bash
npx wrangler d1 execute DB --remote --command "SELECT id, slug, title FROM collections;"
```

---

### Step 5: Build and Deploy the Application

Run the production build and deployment command:
```bash
npm run cf:deploy
```

This runs:
1. `npm run build` (`tsc && vite build`), compiling the frontend into `./dist`.
2. `wrangler deploy`, bundling `worker/index.ts` and uploading the static assets binding.

Wrangler will output the live deployment URL:
```text
Total Upload: ... KiB / gzip: ... KiB
Uploaded captures-gallery (x.xx sec)
Deployed captures-gallery triggers (x.xx sec)
  https://captures-gallery.<your-subdomain>.workers.dev
Current Version ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

### Step 6: Ingest Initial Media and Captures

You have two workflows to populate your gallery:

#### Workflow A: Interactive Web Admin Curation Studio (`/admin`)
1. Open `https://captures-gallery.<your-subdomain>.workers.dev/admin` in your browser.
2. Sign in via your Cloudflare Access Zero Trust login prompt.
3. Drag and drop high-resolution JPEG, PNG, WebP, or AVIF image files into the dropzone.
4. The client-side `exifr` engine will immediately parse the embedded EXIF telemetry:
   - Camera model, lens model, focal length, aperture (`f/`), shutter speed, ISO, and capture date.
5. Add a curatorial story and select a collection (`architecture`, `street`, or `minimalism`).
6. Click **Publish capture to catalog**. The image is uploaded to R2, and the record is stored in D1.

#### Workflow B: Local Folder Batch Sync CLI (`npm run sync`)
To sync captures directly from local disk folders (`./captures/<collection-slug>/`):

1. Place image files into collection directories:
   ```text
   captures/
   ├── architecture/
   │   ├── brutalist-atrium-01.jpg
   │   └── spiral-concrete-stairs.jpg
   ├── street/
   │   └── night-market-neon.jpg
   └── minimalism/
       └── mist-over-lake-biwa.jpg
   ```
2. Run a dry run to inspect extracted EXIF metadata without modifying remote storage:
   ```bash
   npm run sync -- --dry-run
   ```
3. Upload images to the remote R2 bucket:
   ```bash
   npx wrangler r2 object put captures-gallery-media/captures/architecture/brutalist-atrium-01.jpg --file captures/architecture/brutalist-atrium-01.jpg
   npx wrangler r2 object put captures-gallery-media/captures/architecture/spiral-concrete-stairs.jpg --file captures/architecture/spiral-concrete-stairs.jpg
   npx wrangler r2 object put captures-gallery-media/captures/street/night-market-neon.jpg --file captures/street/night-market-neon.jpg
   npx wrangler r2 object put captures-gallery-media/captures/minimalism/mist-over-lake-biwa.jpg --file captures/minimalism/mist-over-lake-biwa.jpg
   ```
4. Trigger the remote batch sync endpoint using a Cloudflare Access Service Token:
   ```bash
   npx tsx scripts/sync-captures.ts --endpoint https://captures-gallery.<your-subdomain>.workers.dev
   ```

---

## 4. Verification & Testing

Verify that your deployment is functioning properly:

1. **Verify Collections API**:
   ```bash
   curl -s https://captures-gallery.<your-subdomain>.workers.dev/api/collections | jq .
   ```
2. **Verify Captures API**:
   ```bash
   curl -s https://captures-gallery.<your-subdomain>.workers.dev/api/captures | jq .
   ```
3. **Verify R2 Media Delivery & Cache Headers**:
   ```bash
   curl -I https://captures-gallery.<your-subdomain>.workers.dev/api/media/captures/architecture/brutalist-atrium-01.jpg
   ```
   Confirm that the response contains:
   - `HTTP/1.1 200 OK`
   - `Cache-Control: public, max-age=31536000, immutable`
   - `ETag: "..."`
4. **Verify Conditional Request (304 Not Modified)**:
   ```bash
   curl -I -H 'If-None-Match: "..."' https://captures-gallery.<your-subdomain>.workers.dev/api/media/captures/architecture/brutalist-atrium-01.jpg
   ```
   Should return `HTTP/1.1 304 Not Modified`.
5. **Verify Single-Page App Routing**:
   Open `/about`, `/collections`, or `/?photo=<slug>` directly in the browser to ensure the `ASSETS` binding serves `index.html` without 404 errors.

---

## 5. Adding a Custom Domain

To bind your custom apex or subdomain (e.g. `gallery.yourdomain.com`):

1. Ensure `yourdomain.com` is active in your Cloudflare account.
2. In `wrangler.jsonc`, add a `routes` definition:
   ```jsonc
   "routes": [
     {
       "pattern": "gallery.yourdomain.com",
       "custom_domain": true
     }
   ]
   ```
3. Redeploy the Worker:
   ```bash
   npm run cf:deploy
   ```
   Cloudflare automatically provisions SSL/TLS certificates and updates DNS records.

---

## 6. Troubleshooting

| Symptom | Cause | Solution |
| --- | --- | --- |
| `D1_ERROR: no such table: captures` | Migrations were not applied to remote D1 | Run `npx wrangler d1 migrations apply DB --remote` |
| `401 Unauthorized` in Admin Studio | Cloudflare Access JWT validation failed | Check that `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` in `wrangler.jsonc` match your Zero Trust app settings |
| `404 Media object not found` | The requested `r2_key` does not exist in R2 | Ensure the file was uploaded to R2 under `captures/<collection>/<filename>` |
| Blank page or asset 404 | `./dist` directory not generated before deploy | Run `npm run build` before `wrangler deploy` (or use `npm run cf:deploy`) |
| `D1 database not found` | `database_id` in `wrangler.jsonc` is still placeholder | Replace `00000000-...` with the output of `npx wrangler d1 create` |
