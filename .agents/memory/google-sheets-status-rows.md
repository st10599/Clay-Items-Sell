---
name: Google Sheets status rows
description: Durable parsing rules for public Google Sheets inventory data.
---

Public inventory sheets may contain an older row and a newer appended row for the same product. Treat the last row for a normalized product name as authoritative, and check explicit “未售出” values before matching the broader “售出” substring.

**Why:** Chinese status strings such as “未售出” contain “售出”, and stale duplicate rows otherwise make available items appear sold.

**How to apply:** Use these rules whenever the clearance sheet parser is changed or a status discrepancy is reported.