---
name: o11-mcp
description: Use for creating, reading, validating, or changing OutSystems 11 modules through the Service Studio MCP Model API for SG Family Support Finder.
---

# o11-mcp

1. Verify the current open module is `SGFamilySupportFinder`; stop otherwise. Read official MCP guidance and inspect exposed methods/signatures.
2. Read module metadata and validation state before modifications. Use minimal Model API mutations, checking each response.
3. Implement one Reactive Web screen, typed Structures, REST integration, and readable server/client actions. Do not create persistent Entities without demonstrated need.
4. Do not call `omlMerge` or `omlPublish` without explicit user approval. Never touch `Test` or unrelated modules.
5. Report exactly what was created, validated, blocked, and what manual Service Studio work remains.
