import { expect, type APIRequestContext, test } from "@playwright/test";

const apiBaseURL = (process.env.E2E_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");
const e2eUser = process.env.E2E_USER || process.env.E2E_ADMIN_EMAIL || "";
const e2ePassword = process.env.E2E_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "";

test.skip(
  !e2eUser || !e2ePassword,
  "Set E2E_USER and E2E_PASSWORD for a prepared test tenant admin before running this suite.",
);

type ApiPayload = Record<string, unknown>;

async function login(request: APIRequestContext) {
  const res = await request.post(`${apiBaseURL}/auth/login`, {
    data: {
      email: e2eUser.includes("@") ? e2eUser : undefined,
      employeeId: !e2eUser.includes("@") ? e2eUser : undefined,
      password: e2ePassword,
    },
  });

  expect(res.ok(), await res.text()).toBeTruthy();
  const user = await res.json();
  expect(user.token, "login response should include token").toBeTruthy();
  return user;
}

async function api<T = ApiPayload>(
  request: APIRequestContext,
  token: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  data?: ApiPayload,
): Promise<T> {
  const res = await request.fetch(`${apiBaseURL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data,
  });

  expect(res.ok(), `${method} ${path} failed: ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return (body?.data ?? body) as T;
}

async function seedOrderToInvoiceFlow(request: APIRequestContext, token: string) {
  const runId = `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const client = await api(request, token, "POST", "/clients", {
    name: `${runId} Client`,
    email: `${runId.toLowerCase()}@example.test`,
    phone: "000-000",
    address: "E2E test lane",
  });

  const raw = await api(request, token, "POST", "/products", {
    name: `${runId} Raw Material`,
    sku: `${runId}-RAW`,
    price: 5,
    unitCost: 5,
    stock: 10,
    category: "E2E",
  });

  const finishedGood = await api(request, token, "POST", "/products", {
    name: `${runId} Finished Good`,
    sku: `${runId}-FG`,
    price: 100,
    unitCost: 25,
    stock: 0,
    category: "E2E",
  });

  await api(request, token, "POST", "/boms", {
    name: `${runId} BOM`,
    partNumber: `${runId}-BOM`,
    status: "Active",
    outputProduct: finishedGood._id,
    components: [{ product: raw._id, quantity: 1 }],
    routing: [
      {
        sequence: 10,
        code: "CUT",
        name: "Cut and finish",
        workCenterCode: "E2E-WC",
        setupMinutes: 0,
        runMinutesPerUnit: 1,
      },
    ],
  });

  const order = await api(request, token, "POST", "/orders", {
    client: client._id,
    items: [{ product: finishedGood._id, quantity: 2, price: 100 }],
    totalAmount: 200,
    approvalStatus: "none",
    status: "pending",
  });

  const job = await api(request, token, "POST", "/production/from-order", {
    orderId: order._id,
    lineIndex: 0,
    quantity: 2,
    jobId: `${runId}-JOB`,
    priority: "Medium",
  });

  await api(request, token, "POST", "/quality/inspections/submit", {
    productionJob: job._id,
    inspectionType: "final",
    checklistResults: [{ prompt: "Final acceptance", value: "OK", status: "pass" }],
    quantityInspected: 2,
    inspector: "Playwright E2E",
  });

  const completedJob = await api(request, token, "PUT", `/production/${job._id}`, {
    status: "Completed",
  });
  expect(completedJob.status).toBe("Completed");
  expect(completedJob.inventoryPosted).toBe(true);

  const finishedAfterProduction = await api(request, token, "GET", `/products/${finishedGood._id}`);
  expect(finishedAfterProduction.stock).toBe(2);

  const shipment = await api(request, token, "POST", "/shipments", {
    orderId: order._id,
    lines: [{ lineIndex: 0, quantity: 2 }],
    carrier: "E2E Carrier",
    trackingNumber: `${runId}-TRACK`,
  });

  const shipped = await api(request, token, "POST", `/shipments/${shipment._id}/ship`, {
    carrier: "E2E Carrier",
    trackingNumber: `${runId}-TRACK`,
  });
  expect(shipped.status).toBe("shipped");

  const invoice = await api(request, token, "POST", "/finance/invoices/from-order", {
    orderId: order._id,
    shipmentId: shipment._id,
  });
  expect(invoice.order).toBe(order._id);
  expect(invoice.shipment).toBe(shipment._id);
  expect(invoice.amount).toBeGreaterThan(0);

  return {
    runId,
    client,
    order,
    job: completedJob,
    shipment: shipped,
    invoice,
  };
}

test("order to production to shipment to invoice", async ({ page, request }) => {
  const user = await login(request);
  const flow = await seedOrderToInvoiceFlow(request, user.token);

  await page.addInitScript(
    ({ token, userPayload }) => {
      const { token: _token, ...storedUser } = userPayload;
      window.localStorage.setItem("erp_token", token);
      window.localStorage.setItem("erp_user", JSON.stringify(storedUser));
    },
    { token: user.token, userPayload: user },
  );

  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(String(flow.client.name));

  await page.goto("/production-jobs");
  await expect(page.getByRole("heading", { name: /production jobs/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(String(flow.job.jobId));
  await expect(page.locator("body")).toContainText("Completed");

  await page.goto("/shipments");
  await expect(page.getByRole("heading", { name: /shipments/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(String(flow.shipment.shipmentNumber));
  await expect(page.locator("body")).toContainText("Shipped");

  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: /finance/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(String(flow.invoice.invoiceId));
  await expect(page.locator("body")).toContainText("Pending");
});
