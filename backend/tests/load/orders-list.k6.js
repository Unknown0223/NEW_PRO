/**
 * k6 smoke load test — health + optional orders list.
 *
 * Local:
 *   k6 run backend/tests/load/orders-list.k6.js
 *
 * With auth (orders list):
 *   k6 run -e BASE_URL=http://127.0.0.1:18080 -e TENANT_SLUG=test1 -e ACCESS_TOKEN=... backend/tests/load/orders-list.k6.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://127.0.0.1:18080").replace(/\/+$/, "");
const TENANT_SLUG = __ENV.TENANT_SLUG || "";
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || "";

export const options = {
  vus: Number(__ENV.K6_VUS || 5),
  duration: __ENV.K6_DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"]
  }
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    "health status 200": (r) => r.status === 200
  });

  if (TENANT_SLUG && ACCESS_TOKEN) {
    const orders = http.get(`${BASE_URL}/api/${TENANT_SLUG}/orders?limit=10`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    check(orders, {
      "orders list ok": (r) => r.status === 200 || r.status === 401 || r.status === 403
    });
  }

  sleep(0.3);
}
