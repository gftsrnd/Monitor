import * as trpcExpress from '@trpc/server/adapters/express';
import { createContext } from './trpc.js';
import { appRouter } from './routers/index.js';
import {
  generateOpenApiDocument,
  createOpenApiExpressMiddleware,
  forEachOpenApiProcedure,
  getPathRegExp,
  normalizePath,
} from 'trpc-to-openapi';
import type { Request } from 'express';
const packageJson = await import('../../../package.json', {
  with: { type: 'json' },
});

export type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

const procedurePaths = new Set(Object.keys(appRouter._def.procedures));
const openapiRoutes: { method: string; path: string; pattern: RegExp }[] = [];
forEachOpenApiProcedure(appRouter._def.procedures, ({ type, meta }) => {
  if (type === 'subscription') return;
  const path = normalizePath(meta.openapi.path);
  openapiRoutes.push({
    method: meta.openapi.method,
    path,
    pattern: getPathRegExp(path),
  });
});

export function trpcMetricsRoute(req: Request): string | undefined {
  const baseUrl = req.baseUrl.toLowerCase();
  if (baseUrl === '/open') {
    const path = normalizePath(req.path);
    const route = openapiRoutes.find(
      (route) => route.method === req.method && route.pattern.test(path)
    );
    return route ? `/open${route.path}` : '/open';
  }
  if (baseUrl === '/trpc') {
    if (req.query.batch === '1') return '/trpc/batch';

    let path: string;
    try {
      path = decodeURIComponent(req.path.slice(req.path.lastIndexOf('/') + 1));
    } catch {
      return '/trpc';
    }
    return procedurePaths.has(path) ? `/trpc/${path}` : '/trpc';
  }
}

export const trpcExpressMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext,
  onError: ({ path, error }) => {
    console.error('Error:', path, error);
  },
});

export const trpcOpenapiHttpHandler = createOpenApiExpressMiddleware({
  router: appRouter,
  createContext,
});

const title = 'TFG Monitor OpenAPI';

const description = `
## TFG Monitor — Hệ thống Giám sát & Phân tích Tin Funding Group

**TFG Monitor** (https://monitor.tinfundinggroup.net) là nền tảng giám sát tập trung, đo lường độ trễ (uptime), thu thập telemetry máy chủ và phân tích lượt truy cập thời gian thực cho hệ sinh thái Tin Funding Group.

### Các Tính năng Chính

- **Phân tích Lượt truy cập Website** — Đo lường lượng truy cập không cần cookie bên thứ ba (bảo vệ quyền riêng tư người dùng).
- **Giám sát Uptime & Độ trễ** — Theo dõi liên tục 24/7 tình trạng hoạt động và chứng chỉ SSL của các dịch vụ.
- **Trạng thái Máy chủ (Server Status)** — Giám sát CPU, RAM, Disk, Network VPS theo thời gian thực qua Podman & Reporter.
- **Trang Trạng thái Công khai (Status Pages)** — Hiển thị uptime và thông báo bảo trì cho khách hàng.
- **Cảnh báo Đa kênh** — Tích hợp gửi thông báo qua Email, Telegram, Discord, Webhook khi phát sinh sự cố.
- **AI Gateway & Proxy** — Quản lý token, chi phí và định tuyến yêu cầu AI tập trung.

### Xác thực API (Authentication)

TFG Monitor API sử dụng xác thực **Bearer Token**. Đính kèm API key vào header HTTP Authorization:

\`\`\`
Authorization: Bearer <YOUR_API_KEY>
\`\`\`

**Cách tạo API key:**
1. Đăng nhập vào trang quản trị TFG Monitor (\`https://monitor.tinfundinggroup.net\`)
2. Điều hướng tới **Settings → API Keys**
3. Tạo API key mới với phân quyền phù hợp và lưu trữ an toàn.
`.trim();

export const trpcOpenapiDocument = generateOpenApiDocument(appRouter, {
  title,
  description,
  version: `v${packageJson.default.version}`,
  baseUrl: '/open',
});
