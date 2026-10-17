---
name: o11-mcp
description: Project rules for creating, reading, validating, or changing the SG Family Support Finder OutSystems 11 modules (LIB / CS / UI) through the Service Studio MCP Model API. Load together with servicestudio-mcp-oml.
---

# o11-mcp (project rules)

The official Model API reference is `.opencode/skills/servicestudio-mcp-oml/SKILL.md`, the same skill as https://github.com/OutSystems/outsystems11-mcp (also pinned as the `outsystems11-mcp-official` submodule). Read it first. This file only adds project rules.

## Modules
- `SGFamilySupport_LIB` (Library): Structures and contracts only.
- `SGFamilySupport_CS` (Service): REST, cache Entities (`CachedCentre`, `CachedOffice`, `CachedProgrammeSite`, `SyncStatus`), `SchemeCatalogue`, sync and getter actions, `GetSchemeRecommendations`.
- `SGFamilySupportFinder` (Reactive Web): `FindCentres`, `FindSupport`, `CentreDetailsPanel`.

Put each change in the module that owns that concern. UI never calls REST or holds business rules. LIB never holds logic.

## Session and calls
1. Call `createSessionToken({clientName})` exactly once per session and pass `sessionToken` on every call.
2. Every tool except `listApps` takes its arguments wrapped in `input`.
3. Read first:
   - `listApps`
   - `getDataModel`
   - `getStructures`
   - `getScreenNames` / `getScreen`
   - the action name tools
   - `getValidationMessages`
4. Confirm the module open in Service Studio is the one you intend to change, and stop if it isn't. The user has to switch modules in Studio.

## Writing
1. Write with `applyModelApiCode({eSpaceName, code: "eSpace => { … }", imports})`. Pass the full lambda with no `eSpace.Save`. Edits chain through a per-module session pointer.
2. Then call `omlMerge({eSpaceName, mutatedOmlPath})` until it returns `merged: true`. Never call `omlMerge` twice on the same path, because a successful merge deletes the file.
3. Check `getValidationMessages` after every change. Keep changes minimal.
4. `omlPublish` requires the user's explicit approval. `omlReset` is only for recovering from your own bad change, and you must say so when you use it.
5. The write tools are OutSystems Beta. The first time you use one in a session, tell the user and share https://www.outsystems.com/legal/beta-features-agreement.

## Known limits (Service Studio 11.55.92)
- **Timers cannot be created via MCP.** The merge rejects the timer-schedule feature. `SeedDatasetCache` and `RefreshDatasetCache` were made in Studio, so never recreate them through the Model API.
- New cross-module or Forge dependencies can't be added via MCP. Add the reference in Service Studio first.
- Translations can't be written.

## Report
Say exactly what was created or changed per module, the validation state, whether it is merged but unpublished, and what manual Service Studio work remains.
