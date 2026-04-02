# Open Courses

Public community courses for Mokumoku live here.

## Repository Layout

```text
README.md
courses.json
courses/
  <slug>/
    config.json
    ...additional assets
scripts/
.github/workflows/
```

## Course Format

Each `courses/<slug>/config.json` must contain a single Mokumoku course package:

```json
{
  "schemaVersion": "1.0.0",
  "course": {},
  "patterns": []
}
```

Rules:

- `course.id` must be stable and unique across the repo
- every `patterns[].category` must equal `course.id`
- assets referenced by relative path must live inside that course folder
- update `courses.json` whenever you add or rename a course folder

## Submitting Courses

1. Add or update a folder under `courses/`
2. Put the course package in `config.json`
3. Add any referenced images or other assets next to `config.json`
4. Update `courses.json`
5. Open a pull request

The GitHub Actions workflow validates the repository structure and the course package shape on every PR.
