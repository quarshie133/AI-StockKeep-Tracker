Test Evidence — Contents
=========================

api_test_evidence.log
  Raw, unedited output of 26 curl-based API test cases (TC-API-01 to
  TC-API-26) executed against a live local instance of StockKeep
  (http://localhost:3001, npm run dev, SQLite dev database) on
  2026-08-13. Every HTTP status code and JSON response body in this
  file is a genuine captured result, not a prediction. Referenced from
  Testing_Report.pdf Section 5 and the requirements traceability matrix.

server_error_trace_DEF-01.log
  Extracted dev-server console output showing the stack trace behind
  defect DEF-01 (HTTP 500 instead of 400 on invalid item/adjustment
  data). Referenced from Testing_Report.pdf, Section 10 (Defects).

What is NOT in this folder:
  UI-level test evidence (screenshots of test execution, browser
  console logs, visual regression captures) — no browser automation was
  available in the environment used to prepare this documentation. See
  Supporting_Files/Screenshots/README_SCREENSHOTS_PENDING.txt.
  Load/performance test evidence — no formal load testing was performed;
  see Testing_Report.pdf Section 11 for the informal single-request
  latency figures that were captured incidentally during the API test run.
