# Storage

The drive against a real bucket: Cloudflare R2, AWS S3, MinIO, or anything
else that speaks S3. The bytes go from the page straight to the bucket, at
addresses the server signs; the entries stay in `storage/bucket.sqlite` on
this computer, apart from the playground's.

## Setting it up

1. A bucket, and a key that may read and write in it. On R2: **R2 → Create
   bucket**, then **Manage API tokens → Create API token**, "Object Read &
   Write", for that bucket only.
2. `cp apps/storage/.env.example apps/storage/.env`, and fill it in. git
   leaves `.env` out.
3. The bucket's rule of origins, so the page may send to it and read from it:
   `cors.json`. On R2: **the bucket → Settings → CORS policy → Edit**, and
   paste it. On AWS: `aws s3api put-bucket-cors --bucket <bucket> --cors-configuration "{\"CORSRules\": $(cat apps/storage/cors.json)}"`.
   MinIO lets every origin in unless told otherwise.

MinIO on this computer, for trying it without an account:

```bash
docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address :9001
# make the bucket at http://localhost:9001 (minioadmin / minioadmin)
```

## Using it

```bash
npm run storage:check   # from the root: the whole way a file goes, from Node, and everything deleted after
npm run storage:seed    # a few folders and files, to have something to look at
npm run storage         # the page: http://localhost:5183
```

`storage:check` goes first: a small file in one PUT, one of 16 MiB in parts,
each read back and compared byte for byte, a second version, a download shown
in the page, and the deletion, checked in the bucket. When the bucket refuses
something, it says what the bucket answered.

The page asks one thing more of the bucket than the check does, its rule of
origins: an upload that stops at once with "check that it lets this origin
in" is that.

`?lang=es` shows the drive in Spanish; `?view=grid` starts with the grid.

Deleting `storage/bucket.sqlite` starts the drive over, but what it named
stays in the bucket until deleted there. Seeding twice gives "(2)" of each
file.

No one signs in, and everyone may do everything: it is for one's own
machine. `server/bucket.ts` is where a site would say who is asking and what
they may do.
