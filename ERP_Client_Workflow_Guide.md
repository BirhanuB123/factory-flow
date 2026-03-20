# Factory Flow ERP - Client Workflow Guide

## Purpose
This document explains how a new client can use the ERP system from daily operations to reporting.

---

## 1) Login and Access Control

1. Open the ERP login page.
2. Enter employee ID/email and password.
3. After login, the system shows modules based on role.

### Common Roles
- `Admin`: full access to all modules and approvals.
- `hr_head`: HR and payroll operations.
- `finance_head`: finance operations with full finance actions.
- `finance_viewer`: finance visibility and reporting (limited write actions).
- `purchasing_head`: purchase orders and procurement flow.
- `warehouse_head`: receiving, stock movement, and shipping.
- `employee`: standard operational visibility with limited actions.

---

## 2) Core End-to-End Business Flow

### Step A - Master Data Setup (Initial)
Set up core records before transactions:
- Products/SKUs (Inventory)
- BOMs (Bill of Materials)
- Clients
- Employees and roles
- Vendors (for AP and PO to bill flow)
- Ethiopia tax settings (if required)

### Step B - Sales Order Intake
1. Go to **Orders**.
2. Create a new order and add line items.
3. Track order status (`pending`, `processing`, `shipped`, `delivered`, `cancelled`).

System support:
- Demand/supply visibility (MRP suggestions).
- Reserve finished goods directly from stock.
- Create a linked production job from order line.

### Step C - Production Planning and Execution
1. Go to **Production Jobs**.
2. Create/sync job from BOM and routing.
3. Reserve BOM materials for job.
4. On shop floor, update operation progress:
   - Start operation
   - Log labor time
   - Record scrap/rework
   - Complete operation
5. Complete job to update inventory posting.

### Step D - Procurement and Receiving
1. Go to **Purchase Orders**.
2. Create PO draft with product lines and costs.
3. Add sourcing details when needed:
   - Local or import
   - FX rate to ETB
   - Freight/duty/clearing
   - LC reference/bank/amount (import cases)
4. Approve PO.
5. Receive quantities (full or partial) with lot/batch details.
6. Stock ledger updates automatically after receipt.

### Step E - Inventory Control
1. Go to **Inventory**.
2. Monitor stock levels and low-stock alerts.
3. Post manual movements if needed:
   - Receipt
   - Issue
   - Adjustment
4. Use movement history for audit and traceability.

### Step F - Shipping and Fulfillment
1. Go to **Shipments**.
2. Create shipment draft from order line (partial shipment supported).
3. Move status through process:
   - `draft` -> `picked` -> `packed` -> `shipped`
4. Add carrier and tracking number.
5. Print delivery note.

### Step G - Finance Operations
1. Go to **Finance**.
2. Record and monitor:
   - Invoices
   - Expenses
   - AR aging
   - AP/vendor bills and payments
3. Create invoice from order/shipment flow.
4. Generate exports:
   - AR/AP
   - Orders
   - Inventory
   - Production
   - Ethiopia VAT/withholding CSV reports
5. Print tax invoice where required.

### Step H - HR and Payroll
1. Go to **HR**.
2. Manage employees, departments, and status.
3. Maintain attendance records.
4. Run payroll by month:
   - Prepare run
   - Adjust overtime/allowances/deductions
   - Calculate and save payroll
5. Export:
   - Pension CSV
   - Income tax CSV
6. Print payslips and mark payment status.

---

## 3) Recommended Daily Operations by Team

### Sales / Operations
- Create and monitor orders.
- Coordinate make-vs-stock decisions.

### Production
- Manage job execution and operation timing.
- Keep work status updated for planning accuracy.

### Purchasing
- Create and track POs.
- Manage supplier sourcing details.

### Warehouse
- Receive materials and post stock movements.
- Process and ship outbound orders.

### Finance
- Maintain invoice/expense ledger.
- Track AR/AP aging.
- Run statutory and management exports.

### HR
- Maintain employee master records.
- Run monthly payroll and statutory exports.

---

## 4) New Client Demo Script (10-15 Minutes)

1. Login as Admin.
2. Create one client, one product, and one BOM.
3. Create a sales order.
4. Show MRP suggestion and create linked production job.
5. Reserve materials and update one job operation.
6. Create PO draft -> approve -> receive partial.
7. Create shipment -> mark shipped.
8. Create invoice from order/shipment.
9. Open AR aging view.
10. Open HR payroll run and export a payroll CSV.

---

## 5) Key Value for Clients

Factory Flow ERP provides one connected workflow:

**Order -> Planning -> Production -> Inventory -> Shipment -> Finance -> HR Payroll**

This reduces manual handoffs, improves traceability, and gives role-based control across the business.
