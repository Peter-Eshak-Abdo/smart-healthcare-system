import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    'http_req_duration{endpoint:health}': ['p(95)<300'],
    'http_req_duration{endpoint:rx_check}': ['p(95)<800'],
    'http_req_duration{endpoint:emergency_identify}': ['p(95)<3000'],
  },
};

const BASE = __ENV.API_BASE_URL || 'http://127.0.0.1:4000';

export default function () {
  const res = http.get(`${BASE}/v1/health`, {
    headers: { 'X-Client': 'k6/1.0.0' },
    tags: { endpoint: 'health' },
  });
  check(res, { 'health status 200': (r) => r.status === 200 });
}
