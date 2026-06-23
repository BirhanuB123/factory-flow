# Backups And Restore

MongoDB is the source of truth for Factory Flow ERP. Treat backup verification as a production release requirement.

## What To Back Up

Back up:

- MongoDB database from `MONGODB_URI`.
- Backend uploaded files under `backend/uploads`.
- Production environment variable inventory, excluding secret values from documents.
- Deployment release identifiers for frontend and backend.

Do not rely on source control for runtime uploads or database state.

## Recommended Schedule

- Full MongoDB backup: daily.
- Upload directory backup: daily, or more often if avatars/documents are business-critical.
- Retention: at least 14 daily backups and 3 monthly backups.
- Restore drill: monthly, and before onboarding the first paying customer.

## MongoDB Backup

For a standalone MongoDB instance:

```bash
mkdir -p backups
mongodump --uri="$MONGODB_URI" --archive="backups/factory-flow-$(date +%Y%m%d-%H%M%S).archive" --gzip
```

For MongoDB Atlas, use Atlas scheduled backups where available. Keep at least one tested manual `mongodump` path for emergency restores.

## Uploads Backup

From the backend server:

```bash
tar -czf "backups/uploads-$(date +%Y%m%d-%H%M%S).tar.gz" -C backend uploads
```

Store backups outside the application server, such as object storage or a managed backup service.

## Restore To A Staging Database

Always test restore in staging before touching production.

```bash
mongorestore --uri="$STAGING_MONGODB_URI" --archive="backups/factory-flow-YYYYMMDD-HHMMSS.archive" --gzip --drop
```

Restore uploads:

```bash
tar -xzf backups/uploads-YYYYMMDD-HHMMSS.tar.gz -C backend
```

Then start the backend with staging variables and run:

```bash
curl --fail http://localhost:5000/api/health
```

Verify login, tenant data, products, orders, finance records, HR records, and platform tenant list.

## Production Restore Procedure

Use production restore only when the business owner approves data rollback.

1. Stop backend writes by stopping the backend process or putting the app in maintenance mode.
2. Record the current release version and current time.
3. Take an emergency backup of current production before restoring.
4. Restore MongoDB with `mongorestore --drop`.
5. Restore `backend/uploads` if needed.
6. Start backend.
7. Run `/api/health`.
8. Validate a tenant admin login and key business records.
9. Re-enable traffic.

Example:

```bash
mongodump --uri="$MONGODB_URI" --archive="backups/pre-restore-$(date +%Y%m%d-%H%M%S).archive" --gzip
mongorestore --uri="$MONGODB_URI" --archive="backups/factory-flow-YYYYMMDD-HHMMSS.archive" --gzip --drop
```

## Restore Acceptance Checklist

The restore is acceptable only when:

- `/api/health` returns success.
- Login works for a platform super-admin and a tenant admin.
- Tenant module flags are present.
- Inventory products and stock movements are present.
- Orders, purchase orders, shipments, invoices, and payroll records are present.
- No cross-tenant data is visible from a normal tenant account.

## Notes

- If `JWT_SECRET` changes during disaster recovery, existing sessions are invalid unless `JWT_SECRET_PREVIOUS` is configured.
- If billing webhooks were delivered during downtime, replay or reconcile them after restore.
- If uploads are restored to a different host path, confirm `/uploads/...` URLs still work.
