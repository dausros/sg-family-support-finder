---
name: datagov-integration
description: Use when validating and implementing the MSF Family Services GeoJSON dataset and data.gov.sg REST consumption in OutSystems 11.
---

# datagov-integration

1. Verify dataset `d_add23c06f7267e799185c79ccaa2099b` at data.gov.sg and current poll-download API response.
2. Fetch the returned URL only after validating its host and response. Inspect actual GeoJSON properties and coordinate order; do not assume field names.
3. Map to a `FamilyServiceCentre` Structure, preserving postal codes as Text. Handle missing values and invalid coordinates.
4. Fetch once on screen load, filter locally for the small dataset; add caching only if necessary.
5. Include source attribution, graceful API errors, retry and no-results states. Never hardcode final records.
