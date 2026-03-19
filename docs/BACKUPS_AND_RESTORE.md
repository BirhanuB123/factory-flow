# Backups & restore drill

## MongoDB dump (scheduled)

Run nightly (cron / Task Scheduler) from a machine that can reach MongoDB:

```bash
# Replace URI and backup dir
mongodump --uri="$MONGODB_URI" --out=/backups/factory-flow/$(date +%Y%m%d)
```

Compress archives off-server (S3, another disk).

## Restore drill (quarterly)

1. **Copy** a recent dump folder to a safe machine.
2. **Restore to a throwaway database** (never overwrite prod without approval):

   ```bash
   mongorestore --uri="mongodb://127.0.0.1:27017" --drop --nsFrom="factory_flow.*" --nsTo="factory_flow_restore.*" /path/to/dump/factory_flow
   ```

3. Point a **staging** app at `factory_flow_restore` and smoke-test login, one order, inventory.
4. Document date, operator, and any issues.

## Application config

- Keep `.env` / secrets **out** of dumps.
- After restore, confirm `JWT_SECRET` matches what issued existing tokens (or users re-login).

## Optional audit collection

With `AUDIT_LOG_ENABLED=true`, collection `auditlogs` grows over time — include it in retention policy or archive old rows.
