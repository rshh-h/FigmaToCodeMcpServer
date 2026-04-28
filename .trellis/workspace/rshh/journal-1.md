# Journal - rshh (Part 1)

> AI development session journal
> Started: 2026-04-23

---



## Session 1: 完成 bootstrap 规范与基线修复

**Date**: 2026-04-23
**Task**: 完成 bootstrap 规范与基线修复
**Branch**: `main`

### Summary

将 Trellis bootstrap 规范调整为 backend/MCP 工程约束，并正向修复 codegen-kernel 与 figma-rest-mcp-server 的类型、测试、构建基线问题；最终通过 pnpm type-check、pnpm test、pnpm build。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5a8f434` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: 完成 Figma 节点截图工具

**Date**: 2026-04-23
**Task**: 完成 Figma 节点截图工具
**Branch**: `main`

### Summary

新增 figma_to_code_fetch_screenshot 工具，支持将单节点截图缓存到独立 screenshot 目录；同步更新中英文 README、backend spec，并完成 type-check、test、build 验证。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1273919` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Fix Windows CLI entrypoint

**Date**: 2026-04-24
**Task**: Fix Windows CLI entrypoint
**Branch**: `main`

### Summary

Fixed anchor-d2c-mcp no-op on Windows by replacing hand-built file URL entrypoint checks with normalized cross-platform path comparison, added regression coverage, and updated backend quality guidance.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b4658ec` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: 图片资源命名改为小写下划线

**Date**: 2026-04-28
**Task**: 图片资源命名改为小写下划线
**Branch**: `main`

### Summary

将本地图片、向量、截图及相关 manifest 产物命名统一为小写 snake_case，并更新测试和后端 spec。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e13c9ab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
