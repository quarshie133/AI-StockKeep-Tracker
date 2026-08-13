# StockKeep — Final Submission Readiness Report

Prepared: 2026-08-13. This report assesses the documentation package in `StudentID_StockKeep/` against the submission requirements, and lists exactly what remains for the student to do before uploading to SAKAI.

## Complete

- **Project_Documentation.pdf** — master report, all 37 required sections present, cover page, ToC, List of Figures, List of Tables, numbered chapters, page numbers, 8 embedded diagrams, references, compliance checklist.
- **SRS.pdf** — standalone, consistent with the master document and the requirements traceability matrix.
- **Testing_Report.pdf** — standalone, includes 26 live-executed API test cases with real captured HTTP responses (not fabricated), 5 defects found, a testing summary, and a requirements-to-test traceability table.
- **Technical_Debt_Plan.pdf** — standalone, 15-item debt register classified and prioritised, with a phased repayment roadmap (Immediate / v1.1 / v2.0 / Long-Term).
- **User_Manual.pdf** — standalone, covers every required topic (login through troubleshooting), with clearly labelled screenshot placeholders (`[INSERT SCREENSHOT — ...]`) rather than fabricated images.
- **Deployment_and_Source_Links.txt** — present, correct structure, all unknown values left as `[TO BE PROVIDED]` rather than invented.
- **Supporting_Files/** — populated with:
  - 8 diagrams generated directly from the source code/schema (Architecture, ER, Use Case, 3× Sequence, Activity, Component), plus 2 additional high-quality diagrams (a swimlane activity diagram and a detailed UML sequence diagram) found already present in the folder from an earlier documentation pass — see "Note on duplicate diagrams" below.
  - `Requirements_Traceability/requirements_traceability_matrix.md` — full FR/NFR/AUTH/SEC → test/file mapping.
  - `Test_Evidence/` — real `curl`-captured API test log and a server error-trace log for defect DEF-01.
  - `Screenshots/README_SCREENSHOTS_PENDING.txt` — explains why screenshots are absent and exactly what to capture.
- No secrets, API keys, or credentials are included anywhere in the package (values are either absent or explicitly `[TO BE PROVIDED]`).
- No fabricated test results — every result in `Testing_Report.pdf` is labelled as live-executed, code-review-only, or "Not verified — execution required by student."
- No unsupported functionality is claimed — features that don't work as intended (e.g., the Settings passcode field) are explicitly flagged, not hidden.

## Requires Student Input

- Student Name, Student ID, Institution, Department, Module/Course Code, Supervisor Name — currently `[TO BE PROVIDED]` on every document's cover page (identical placeholder text used consistently across all 6 documents; a single find-and-replace across the 5 `.md` source files before rebuilding, or a PDF-level edit, will update them all).
- Live Application URL, Admin URL, Test Password, Source Code Repository URL — in `Deployment_and_Source_Links.txt`.
- Real application screenshots — see `Supporting_Files/Screenshots/README_SCREENSHOTS_PENDING.txt` for the exact list needed and where they plug into `User_Manual.pdf`.

## Requires Verification

- **DEF-01 re-test under a production build.** All testing was run against `next dev`; DEF-01 (HTTP 500 instead of 400 on invalid item/adjustment data) should be re-tested against `next build && next start` in case it is a development-mode-only artifact.
- **UI/system-level testing.** No browser automation was available while preparing this package, so no rendered-UI testing occurred. Manually walk through the flows listed in `Testing_Report.pdf` Section 7 (System Testing) and Section 9 (UAT) before submission.
- **Usability and performance/load testing.** Not performed at all; `Testing_Report.pdf` Sections 10 and 11 explain the informal latency figures that were captured incidentally and what a proper pass would still need to cover.
- **AI feature configuration (TD-13).** Live testing found the configured Gemini model (`gemini-1.5-flash`) currently returns `404 Not Found` for this project's API key — every AI feature is running on its fallback logic only. Confirm the correct/available model name with your Gemini account before claiming the AI features work with live AI output.
- **Deployment.** The application has not been deployed to a public URL as part of this documentation pass; all testing was against a local dev server. Deploy, then re-run at least a smoke test of the API test cases against the live URL.

## Missing / Incomplete

- **Automated test suite.** Zero unit/integration/E2E tests exist in the repository (TD-07). If the marking rubric requires automated tests specifically (as opposed to documented manual testing), this is a genuine gap, not a documentation omission — implementing it is a code change, not something this documentation pass can produce on its own.
- **Multi-user roles / admin distinction.** The `Deployment_and_Source_Links.txt` template asks for separate Admin URL/credentials; the current system has no such role. This has been marked "Not applicable in the current build" rather than invented — confirm this is acceptable for your rubric, or implement role separation if required.
- **Five known defects/gaps are unresolved in the code** (DEF-01 through DEF-05, detailed in `Testing_Report.pdf` and `Technical_Debt_Plan.pdf`). This documentation package documents them accurately; it does not fix them. Fixing the Critical/Immediate items (TD-01, TD-02, TD-03, TD-06, TD-08, TD-13) before a real deployment is strongly recommended.

## Note on Duplicate/Supplementary Diagrams

Two files were found already present in `Supporting_Files/` from what appears to be an earlier attempt at this same documentation task: `Activity_Diagram/Activity_Diagram.png` (a richer, swimlane-based activity diagram covering inventory management, stock adjustment, and sales together) and `Sequence_Diagrams/Sequence_StockAdjust.png` (a detailed UML sequence diagram with activation bars and alt/opt fragments for the stock-adjustment flow). Both are good-quality and were left in place rather than deleted, alongside this session's freshly generated `activity_stock_adjustment.png` and `sequence_stock_adjustment.png`. They cover overlapping ground with slightly different detail/style. **Recommended action:** review both versions and either keep both (more evidence of iteration is not a weakness) or delete the one you prefer less, before final submission — this is a five-minute manual decision, not something to automate away.

(Five other capitalized filenames that appeared in initial directory listings — e.g. `Architecture_Diagram.png` alongside `architecture_diagram.png` — are the *same file* on Windows' case-insensitive filesystem, not duplicates; no action needed for those.)

## Recommended Final Actions (in order)

1. Fill in Student Name/ID/Institution/Department/Module/Supervisor across all 5 documents (`.md` sources are in the session's working files if you want to batch-edit and rebuild, or edit the 5 PDFs directly).
2. Deploy the application and fill in `Deployment_and_Source_Links.txt`.
3. Capture the 16 screenshots listed in `Supporting_Files/Screenshots/README_SCREENSHOTS_PENDING.txt` and insert them into `User_Manual.pdf`.
4. Re-test DEF-01 against a production build (`next build && next start`) and update `Testing_Report.pdf` if the result changes.
5. Resolve the "Note on Duplicate/Supplementary Diagrams" decision above.
6. Optionally address the Critical/Immediate technical debt items (TD-01, TD-02, TD-03, TD-06, TD-08, TD-13) if the rubric rewards a remediated system rather than only its documentation.
7. Re-zip the `StudentID_StockKeep/` folder as `StudentID_StockKeep.zip` (rename the folder and file with your real Student ID first) and upload to SAKAI.
