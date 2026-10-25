# Project Rules — Simple Budget

## Project-Specific Conventions

### Targets & Platforms
- **Strategy**: Single web codebase to target all platforms
- **Targets**: Web, Android, GrapheneOS
- **Delivery**: TBD (PWA preferred initially)

### Architecture
- **Server**: `server/` (backend) - TBD
- **Client**: `client/` (web frontend) - TBD
- **Docs**:
  - Design specs and prototypes: `docs/design/` - 
  - Defect tracking: `docs/defects/`
  - Security/quality audits:`docs/audits/`
- **Network Exposure**: Networked

### Versioning
- Scheme: `v{major}.{subversion}.{completed-item}` (see `versioning.md`)
- Current: **v0.0.0** (major=0, subversion=0, item=0)
- Update TBD
- Version bump = commit (autonomous per `version-control.md`)

### Commands
- TBD

### Testing
- Unit tests: TBD
- Run: TBD
- Test files:  TBD

### Git
- Use a remote repo (per `version-control.md`)
- Branch: `main`
- Commit on every version bump; ask before checkpoint commits
- Stage specific files only (`git add <file>...`), never `git add .`
- `.gitignore` covers: TBD

### Project Specific Conventions
- TBD

## Pointers to Global Rules
- Persona & communication: `/home/shash/Documents/AI_rules/global/base-PERSONA.md`
- Progress updates: `/home/shash/Documents/AI_rules/global/workflow-progress-updates.md`
- Versioning: `/home/shash/Documents/AI_rules/versioning_instructions/versioning.md`
- Version control: `/home/shash/Documents/AI_rules/versioning_instructions/version-control.md`
- Severity matrix (NETWORKED): `/home/shash/Documents/AI_rules/project_level_instructions/issue-severity-matrix_NETWORKED.md`
- Dev environment: `/home/shash/Documents/AI_rules/project_level_instructions/dev-environment.md`
- Troubleshooting: `/home/shash/Documents/AI_rules/project_level_instructions/troubleshooting.md`
- Security report style: `/home/shash/Documents/AI_rules/project_level_instructions/security-report-style.md`
- Project start: `/home/shash/Documents/AI_rules/project_level_instructions/project-start.md`

## AI Assistant behavior
- This is planned as a vibecoded app. You are expected to run full CRUD process. 
- Give brief descriptions of what you are doing to the user.
- When there is a design or architecture gap **STOP** the impacted task and get input from the user.
- Files the user explicitly indicates go in `/docs/` **MUST** be allowed to be created, stored in the specified location, and follow the project naming convention of `{nnnn}-{doc_title}.md` (where applicable). If the user asks you to create a file (including PNG, JPG, JPEG, MD, TXT, JSON, YAML, etc.) that will be placed in the `/docs/` directory, you have permission to create and write that file in the specified location following the appropriate naming convention for that file type.