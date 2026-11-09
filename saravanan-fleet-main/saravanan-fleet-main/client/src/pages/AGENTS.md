# AGENTS.md

## Project Overview

This is an existing Fleet Management web application.

The project uses a monorepo structure:

- `client/` — Frontend application built with React and Vite.
- `server/` — Backend application built with Node.js and Express.
- Google Sheets — Primary database for application data.

The application is currently under development and manual testing. Preserve the existing architecture and functionality.

---

## Important Project Rules

Before making any changes:

1. Inspect only the files relevant to the requested task.
2. Do not scan or modify the entire project unnecessarily.
3. Reuse existing utilities, services, components, API patterns, and coding conventions.
4. Make the smallest possible change that fixes the requested issue.
5. Do not refactor unrelated code.
6. Do not redesign the user interface unless explicitly requested.
7. Do not add new dependencies unless absolutely necessary.
8. Do not change the project architecture without explicit approval.

---

## Frontend Rules

Location: `client/`

- Preserve the existing UI, layout, colors, fonts, navigation, charts, and styling.
- Do not rebuild existing pages or components.
- Maintain existing desktop functionality.
- When modifying a feature, check related state and API calls only.
- Use the existing API service/configuration instead of creating duplicate API clients.
- Keep mobile responsiveness compatible with the existing desktop design.
- Do not hardcode backend URLs when an existing configuration mechanism is available.

---

## Backend Rules

Location: `server/`

- Preserve the existing Express API structure and routes.
- Do not change API contracts unless required to fix the requested issue.
- Keep Google Sheets credentials and secrets on the backend only.
- Never expose credentials, service-account JSON, API keys, or private keys to the frontend.
- Use environment variables for sensitive configuration.
- Do not commit `.env` files or credential files.

---

## Google Sheets Data Rules

Google Sheets is the primary database.

When working with data:

- Treat Google Sheets as the source of truth.
- Do not replace Google Sheets with another database.
- Avoid creating duplicate records.
- Preserve the existing spreadsheet structure unless explicitly required.
- Ensure create, read, update, and delete operations affect the correct record.
- Do not silently use stale local data when the Google Sheets connection is available.
- If caching or local state exists, ensure it is refreshed after create, update, or delete operations.
- Changes made directly in Google Sheets should be reflected in the application after the existing refresh or synchronization process.

---

## Record Deletion Rules

When implementing or modifying delete functionality:

1. Identify the correct record using the existing unique identifier.
2. Delete the corresponding record from Google Sheets.
3. Remove the record from the frontend state.
4. Refresh related data and dashboard calculations.
5. Do not delete unrelated records.
6. Use the existing confirmation and notification patterns.

---

## Dashboard Rules

The dashboard must use current application data.

When fixing dashboard issues:

- Verify the source of every affected metric.
- Ensure calculations use the latest available records.
- Update dashboard data after create, update, or delete operations.
- Do not change dashboard design unless explicitly requested.
- Do not introduce hardcoded statistics or mock values.

---

## Testing Guidelines

After making changes:

1. Test only the affected feature and directly related functionality.
2. Check for existing build or type errors caused by the changes.
3. Verify that existing functionality remains intact.
4. For data changes, verify the complete flow:

   Application → Backend → Google Sheets → Application/Dashboard

5. Do not modify real production records for testing. Use test records where possible.

---

## File Modification Policy

Before editing:

- Identify the minimum set of files required.
- Prefer editing existing files over creating duplicate implementations.
- Do not rename, move, or delete files unless necessary.
- Do not modify generated files, dependency lock files, or configuration files unless required by the task.

After editing:

- Clearly report the files changed.
- Briefly explain why each file was changed.
- Report any assumptions or limitations.

---

## Efficiency Rules

To reduce unnecessary work and token usage:

- Read relevant files first; do not inspect the entire repository by default.
- Do not repeatedly analyze files that have not changed.
- Keep responses and implementation plans concise.
- Avoid unnecessary explanations, refactoring, or alternative implementations.
- Reuse existing project patterns.
- Stop once the requested task is completed and verified.

---

## Strict Preservation Rule

This is an existing application.

**Do not change anything outside the scope of the user's requested task.**

Unless explicitly requested:

- Do not redesign the application.
- Do not change UI styling.
- Do not change navigation.
- Do not replace the technology stack.
- Do not replace Google Sheets.
- Do not rebuild working features.
- Do not introduce unrelated functionality.

Always prioritize a targeted fix over a large-scale rewrite.