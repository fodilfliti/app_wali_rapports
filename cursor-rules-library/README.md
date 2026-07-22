# Cursor rules library (copies for later use)

These are **draft / library** copies of Cursor rules for the platform-hardening strategy.

They are **not** active until you copy them into [`.cursor/rules/`](../.cursor/rules/) as **`.mdc`** files.

## How to activate

```powershell
# From repo root — rename .md → .mdc into active rules folder
Copy-Item cursor-rules-library\system-spec.md .cursor\rules\system-spec.mdc -Force
Copy-Item cursor-rules-library\access-policy.md .cursor\rules\access-policy.mdc -Force
Copy-Item cursor-rules-library\routes.md .cursor\rules\routes.mdc -Force
Copy-Item cursor-rules-library\architecture.md .cursor\rules\architecture.mdc -Force
```

Or copy only the files you need. After copy, reload Cursor / start a new agent chat so rules apply.

## Files

| File | Purpose | Suggested `alwaysApply` |
|------|---------|-------------------------|
| `system-spec.md` | Spec-first + 4 roles (incl. CHEF) | true |
| `access-policy.md` | `can*` / assertCan / content_kind matrix | true (after shared package exists) |
| `routes.md` | Shared path builders; no hardcoded hubs | true (after `shared/routes` exists) |
| `architecture.md` | AuthProvider, no token prop-drill, thin routes | true when doing arch cleanup |
| `system-spec.live-backup.md` | Snapshot of the rule currently in `.cursor/rules/` | do not activate (backup only) |

## Related docs

- Strategy: [`PLATFORM_HARDENING_PLAN.md`](../PLATFORM_HARDENING_PLAN.md)
- Spec index: [`SYSTEM_SPEC.md`](../SYSTEM_SPEC.md)
