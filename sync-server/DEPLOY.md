# Generic sync service deployment

This service is intentionally generic. Web Podcasts uses the `podcasts` namespace, while future apps can use other `/v1/<app>/state` namespaces against the same SQLite database.

## VPS deployment

The VPS already routes `https://sync.tangkk-x2o.com` to `127.0.0.1:8788` through Caddy.

1. Stop the temporary Python HTTP server currently occupying port 8788.
2. Copy `sync-server/server.py` to `/opt/sync-service/server.py`.
3. Copy `sync-server/sync-service.service` to `/etc/systemd/system/sync-service.service`.
4. Run:

```bash
chmod 755 /opt/sync-service/server.py
systemctl daemon-reload
systemctl enable --now sync-service
systemctl status sync-service --no-pager
```

5. Verify locally:

```bash
curl -sS http://127.0.0.1:8788/health
```

6. Verify through Caddy:

```bash
curl -sS https://sync.tangkk-x2o.com/health
```

7. Verify CORS from the production origin:

```bash
curl -i -X OPTIONS https://sync.tangkk-x2o.com/v1/podcasts/state \
  -H 'Origin: https://tangkk.github.io' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-sync-key'
```

The response should include `Access-Control-Allow-Origin: https://tangkk.github.io`.

## API

`GET /health` is public.

`GET /v1/<app>/state` and `POST /v1/<app>/state` require `X-Sync-Key`. The server never stores the raw sync key; it stores only its SHA-256 hash as the account namespace.

Example:

```bash
curl -sS https://sync.tangkk-x2o.com/v1/podcasts/state \
  -H 'X-Sync-Key: my-memorable-key'
```

State items have the shape:

```json
{"key":"favorites","value":["show-a"],"updatedAt":1788500000000}
```

The server uses last-write-wins per state key. Web Podcasts performs the finer-grained recent/progress merge client-side before writing back.

## Backup

The only persistent application data is `/opt/sync-service/sync.db` (plus SQLite WAL files while the service is running). A simple periodic copy after `sqlite3 /opt/sync-service/sync.db 'PRAGMA wal_checkpoint(FULL);'` is sufficient for this personal-use workload.
