# Context Map Structure Standards

This document defines the exact, precise inner content structure for all files within the `.context_map` repository. These standards ensure logical consistency, surgical clarity, and architectural stability across all documentation tiers.

---

## 1. Global Context (`global_context.md`)
The "Digital DNA" of the project. It MUST follow this 7-header configuration:

1. **Introduction**: Concise description of what the project does and how it works.
2. **Tech Stack & Dependencies**: Merged list of frameworks, engines, and versioned packages.
3. **Folder Structure**: Visual tree representation with spaced groupings.
4. **Project User Flow**: High-level image processing lifecycle with `Flow` and `Files Involved`.
5. **State Management**: Index of global states.
   - **Internal Structure**:
     - **stateName**:
       - Syntax: `...`
       - Purpose: `...`
       - File Location: `...`
6. **How each file connects with each other**: Architectural hierarchy and "Glue" description.
7. **Points to Consider**: Universal invariants and philosophical advisory.

---

## 2. Decision Logs (`decision_logs.md`)
A distilled timeline of architectural evolution.

- **Header**: `# Decision Logs (Distilled)`
- **Section Level**: `## [Phase N: Title]`
- **Internal Format**:
  - **Issue**: The technical bottleneck or problem encountered.
  - **Decision**: The specific architectural solution chosen.
  - **Reasoning**: The rationale (performance, stability, simplicity).
  - **Implementation**: Brief mention of the specific files or code logic that changed.

---

## 3. Realisations (`realisations.md`)
A repository of immutable architectural truths and "lessons learned."

- **Header**: `# Realisations (Distilled)`
- **Section Level**: `## [Domain Name]` (e.g., Performance Engineering, UX Philosophy)
- **Internal Format**:
  - **Principal Name**: A detailed explanation of the realization, highlighting the invariant that must not be broken.

---

## 4. Shadow Files (`.context_map/context/src/**/*.md`)
The "Digital Twin" of the source code. Every shadow file MUST follow this 7-header configuration:

### 1. Purpose
The philosophical mission and technical role of the file.

### 2. Imports
Detailed breakdown of horizontal dependencies.
- **Internal Structure**:
  - **DependencyName**:
    - Syntax: `...`
    - Purpose: `...`

### 3. Dependencies
Vertical usage mapping.
- **Internal Structure**:
  - **Used by**: List of parent files.
  - **External APIs**: Browser or Model APIs used.

### 4. State Management
Local state, refs, and contexts.
- **Internal Structure**:
  - **variableName (Type)**:
    - Syntax: `...`
    - Purpose: `...`

### 5. Project Flow (V2 Standard)
Execution narrative with explicit logical boundaries.
- **Internal Structure**:
  - `### [N]. [Step Name]`
  - **Flow**: High-level logic description.
  - **Files Involved**: (Required if crossing architectural boundaries)
    - `File.js`: Purpose of the interaction.

### 6. Code Structure
Technical deep-dive into logic blocks (Functions, Classes, Hooks).
- **Internal Structure**:
  - **Name (Type)**:
    - Syntax: `...`
    - Purpose: `...`
    - Working: `...`

### 7. Points To Consider
Advisory rationale and architectural invariants.
- **Internal Structure**:
  - **Invariant Name**: Detailed advisory with the technical "Why" behind the "How".

---

## Formatting Invariants
- **File Links**: Use backticked basenames for file references (e.g., `AppContext.jsx`).
- **Code Terms**: Surround all function names, states, and variable names in backticks (e.g., `process`).
- **Headers**: Use standard Markdown `#` hierarchy.
- **Alerts**: Use GitHub-style `> [!NOTE]` or `> [!IMPORTANT]` sparingly for critical invariants.
