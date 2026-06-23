# Factory Flow ERP Workflow Guide

## Purpose

This guide explains how a company uses Factory Flow ERP from login through daily operations, fulfillment, finance, HR, and reporting.

Factory Flow is a multi-tenant ERP. Each company has its own tenant, and users only see the data and modules enabled for their company. Access is controlled by role, permissions, and tenant module flags.

## 1. Login And Access

Users start at `/login`.

They can sign in with either:

- Email address
- Employee ID

After login, the system loads the user's profile, role, permissions, tenant, enabled modules, and subscription status.

New users may also enter through `/invite`. If a user has a temporary password, the system sends them to `/account/change-password` before they can continue.

### Main Roles

- `Admin`: Full access inside the company.
- `purchasing_head`: Purchase orders, procurement, inventory visibility, manufacturing visibility, shipment viewing, POS.
- `warehouse_head`: Inventory posting, receiving, shipments, manufacturing visibility, POS.
- `finance_head`: Finance read/write, AR/AP, invoices, expenses, tax reports, PO visibility.
- `finance_viewer`: Read-only finance and reporting visibility.
- `hr_head`: HR, employees, attendance, payroll.
- `employee`: Basic dashboard and employee self-service.

Platform super admins use `/platform` to manage tenants, tenant admins, tenant status, trials, and platform audit activity.

## 2. High-Level Business Flow

The main ERP workflow is:

```text
CRM / Clients
  -> Quotes / Orders
  -> MRP Planning
  -> Production or Procurement
  -> Inventory
  -> Shipment or POS Sale
  -> Finance
  -> Reports / Analytics
```

In daily use, the company captures demand, checks supply, manufactures or purchases what is needed, controls stock, ships or sells goods, invoices customers, pays vendors, and reports on performance.

## 3. Initial Setup

Before daily transactions begin, an administrator usually sets up the following master data:

- Company settings
- Products and SKUs
- Inventory locations
- Bills of materials
- Clients
- Vendors
- Employees
- Departments and positions
- Work centers
- Assets and maintenance schedules
- Tax settings
- Document templates
- Quality checklists

Common setup pages:

- `/settings`
- `/inventory`
- `/boms`
- `/clients`
- `/finance`
- `/hr`
- `/document-templates`
- `/quality-settings`

## 4. CRM, Clients, And Orders

Pages:

- `/crm`
- `/clients`
- `/orders`

Typical workflow:

1. Create a lead in CRM.
2. Convert the lead into a client.
3. Create a quote.
4. Convert the quote into an order.
5. Review order lines and required products.
6. Reserve finished goods if stock is available.
7. Create a production job if the order must be manufactured.
8. Use the order later for shipment and invoicing.

Orders are the main source of demand for manufacturing, inventory, shipping, and finance.

## 5. MRP And Planning

MRP compares demand against available supply.

It uses:

- Open sales orders
- Product stock
- Active reservations
- BOM component requirements
- Existing production coverage

Typical workflow:

1. Review open orders.
2. Check MRP suggestions.
3. Decide whether to fulfill from stock, manufacture, or purchase.
4. Reserve finished goods for order lines when stock is available.
5. Create linked production jobs for items that need manufacturing.

## 6. Production Workflow

Pages:

- `/production`
- `/production-jobs`
- `/scheduling`
- `/boms`
- `/maintenance`

Typical workflow:

1. Create products and BOMs.
2. Create a production job manually or from an order line.
3. Reserve BOM materials for the job.
4. Sync or define job operations.
5. Start operation work.
6. Log labor time, WIP, scrap, rework, and quality checks.
7. Issue materials to the job.
8. Return unused materials if needed.
9. Complete the job.
10. Inventory is updated automatically.

When a job is completed, the system consumes BOM components and adds finished goods to stock.

Maintenance supports work centers, assets, preventive maintenance schedules, downtime tracking, and maintenance completion.

## 7. Inventory Workflow

Page:

- `/inventory`

Typical workflow:

1. Create and maintain products.
2. Manage inventory locations.
3. Review stock levels.
4. Monitor low-stock alerts.
5. Review inventory valuation and aging.
6. View stock movements.
7. Post manual movements when authorized.
8. Review or release reservations.

Inventory changes can come from:

- Opening balances
- Manual receipts
- Manual issues
- Adjustments
- Purchase order receiving
- Production material consumption
- Production finished-good output
- POS sales
- Shipment and fulfillment activity

## 8. Procurement And Purchase Orders

Page:

- `/purchase-orders`

Typical workflow:

1. Create a purchase order draft.
2. Add vendor, products, quantities, and unit costs.
3. Add sourcing details such as import, FX, freight, duty, clearing, and LC reference when needed.
4. Approve the purchase order.
5. Receive full or partial quantities.
6. Stock is posted into inventory.
7. Finance can create a vendor bill from the purchase order.
8. Cancel the purchase order if allowed and not fully processed.

Purchase receiving is one of the main ways inventory increases.

## 9. Shipments And Global Trade

Pages:

- `/shipments`
- `/global-trade`
- `/global-trade/:id`

Typical workflow:

1. Create a shipment for an order or delivery.
2. Add logistics details.
3. Pick and pack goods.
4. Add carrier and tracking details.
5. Mark the shipment as shipped.
6. Generate delivery note when needed.
7. Track trade shipment expenses and route information.

Global trade is used for import/export visibility, logistics tracking, landed cost context, and shipment expense recording.

## 10. POS Workflow

Page:

- `/pos`

Typical workflow:

1. Open a POS session.
2. Search or scan products.
3. Add products to cart.
4. Process sale.
5. Print or view receipt.
6. Void sale if required.
7. Review sales history.
8. Close the POS session.
9. Review daily or session reports.

POS is useful for direct retail-style sales while still using the same tenant product and inventory data.

## 11. Finance Workflow

Page:

- `/finance`

Typical workflow:

1. Create invoices manually or from orders.
2. Review AR aging.
3. Track overdue invoices.
4. Create vendors.
5. Create vendor bills manually or from purchase orders.
6. Record vendor payments.
7. Record expenses.
8. Generate tax invoices.
9. Issue withholding certificates.
10. Review COGS for invoices.
11. Export accounting and tax reports.

Finance supports:

- Customer invoices
- AR aging
- Vendor bills
- AP aging
- Vendor payments
- Expenses
- Ethiopia VAT reports
- Withholding reports
- Tax invoices
- Withholding certificates
- Xero and QuickBooks exports

## 12. HR And Payroll Workflow

Pages:

- `/hr`
- `/my-hr`

HR workflow:

1. Create departments.
2. Create positions.
3. Create employees.
4. Invite employees.
5. Track attendance.
6. Review overtime.
7. Manage leave requests.
8. Review attendance corrections.
9. Prepare payroll.
10. Preview payroll.
11. Run monthly payroll.
12. Export pension and income tax CSV files.
13. Print payslips.
14. Post payroll to finance.
15. Close the payroll month.

Employee self-service workflow:

1. Check in.
2. Check out.
3. View own attendance.
4. Request leave.
5. Edit or cancel pending leave.
6. Submit attendance correction requests.

## 13. Quality Workflow

Page:

- `/quality-settings`

Typical workflow:

1. Create quality checklists.
2. Link or search checklists for production work.
3. Submit inspections.
4. Record operation-level quality results.
5. Track non-conformances.
6. Update non-conformance status as issues are resolved.

Quality connects directly to production operations and manufacturing control.

## 14. Reports, Analytics, And Audit

Pages:

- `/`
- `/analytics`
- `/reports`

Common reporting activities:

- Review dashboard KPIs.
- Review OEE analytics.
- Review product profitability.
- Review inventory turnover.
- Export orders.
- Export inventory.
- Export production.
- Export AR.
- Export AP.
- Review audit logs.
- Create saved views for repeated filters.

Reports help management review performance across sales, production, inventory, finance, and operations.

## 15. Daily Team Responsibilities

### Sales And CRM

- Manage leads.
- Maintain clients.
- Create quotes.
- Convert quotes to orders.
- Monitor order status.

### Production

- Review production jobs.
- Reserve materials.
- Run operations.
- Log time, WIP, scrap, rework, and quality.
- Complete jobs.

### Warehouse

- Receive purchase orders.
- Post inventory movements.
- Monitor stock and reservations.
- Pick, pack, and ship orders.

### Procurement

- Create purchase orders.
- Manage sourcing details.
- Approve and track supplier purchases.
- Coordinate receiving with warehouse.

### Finance

- Create invoices.
- Track AR and AP.
- Manage vendors and vendor bills.
- Record payments and expenses.
- Generate tax and accounting exports.

### HR

- Maintain employees.
- Track attendance.
- Manage leave.
- Run payroll.
- Export statutory payroll reports.

### Management

- Review dashboards.
- Monitor reports and analytics.
- Review audit logs.
- Track tenant and subscription status where applicable.

## 16. Recommended Demo Flow

Use this flow for a short client demo:

1. Log in as Admin.
2. Show dashboard and company context.
3. Create or review a client.
4. Create or review a product.
5. Create or review a BOM.
6. Create an order.
7. Show MRP suggestions.
8. Create a production job from the order.
9. Reserve materials.
10. Start and complete a production operation.
11. Receive a purchase order.
12. Review inventory movement.
13. Create shipment and delivery note.
14. Create invoice from the order.
15. Show AR aging.
16. Open HR payroll.
17. Show reports and analytics.

## 17. Summary

Factory Flow ERP connects the company workflow from demand to cash:

```text
Lead -> Client -> Quote -> Order -> Planning -> Production / Procurement
-> Inventory -> Shipment / POS -> Invoice -> Finance -> Reports
```

HR, payroll, quality, maintenance, analytics, and platform administration support the main operational workflow.

