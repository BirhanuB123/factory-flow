# Postman — Factory Flow API

## Why login returns “Invalid credentials”

The collection used **placeholder** credentials (`ADMIN001` / `your-password`). They do **not** exist in the database.

After seeding, real users use:

- **Password (all seeded users):** `password123`
- **Email** or **employeeId** from the table below.

## 1. Seed the database (once per fresh DB)

From the **`backend`** folder:

```bash
node seeder.js
```

⚠️ This **deletes** existing employees, products, POs, etc., then recreates demo data.

## 2. Start the API

```bash
cd backend && npm start
```

Default URL: **http://localhost:5000** (check `PORT` in `.env`).

## 3. Postman variables

| Variable   | Value                      |
|-----------|----------------------------|
| `baseUrl` | `http://localhost:5000`    |

**Important:** `baseUrl` is the server root **without** `/api`.  
Correct login URL: `http://localhost:5000/api/auth/login`.

## 4. Login first

1. Import **`Factory-Flow-API.postman_collection.json`**.
2. Optional: import **`Local.postman_environment.json`** and select it; set `baseUrl` if needed.
3. Run **Auth → Login (seeded Admin)** (or Purchasing / Warehouse for those routes).
4. On **200**, the test script stores **`token`** — other requests then send `Bearer {{token}}`.

If login still fails:

- Confirm MongoDB is running and `MONGODB_URI` in backend `.env` matches where you seeded.
- Re-run `node seeder.js` if users were never created or DB was switched.

## Seeded users (`password123`)

| Email                    | employeeId | Role            |
|--------------------------|------------|-----------------|
| admin@integracnc.com     | EMP-001    | Admin           |
| finance@integracnc.com   | EMP-002    | finance_head    |
| hr@integracnc.com        | EMP-003    | hr_head         |
| employee@integracnc.com  | EMP-004    | employee        |
| buyer@integracnc.com     | EMP-005    | purchasing_head |
| warehouse@integracnc.com | EMP-006    | warehouse_head  |

**Role tips for Postman**

- **Finance / AP / AR / vendor bills:** Admin or **finance@integracnc.com**
- **Purchase orders (create/approve/receive):** **buyer@integracnc.com** (or Admin)
- **Shipments (create/ship):** **warehouse@integracnc.com** (or Admin)
- **HR:** **hr@integracnc.com** or Admin

## IDs

Copy `_id` values from **GET** list endpoints into collection variables (`productId`, `orderId`, etc.) before **POST**/**PUT** calls that need them.
