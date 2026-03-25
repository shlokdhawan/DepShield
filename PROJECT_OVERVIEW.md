# DepShield — Project Overview

---

## What Is This Project?

DepShield is a web application that acts like a **security health check-up for software projects**. When developers build applications, they rely on hundreds of pre-built code packages (called "dependencies") created by other people — think of them as ingredients in a recipe. DepShield scans all of those ingredients, checks if any of them have known security problems, tells you which ones are outdated or no longer maintained, and gives you a clear, prioritized plan to fix everything — all through a beautiful, interactive dashboard.

---

## The Problem It Solves

Modern software projects don't build everything from scratch. A typical project might use **hundreds or even thousands** of third-party packages, and each of those packages might depend on even more packages. This creates a massive, invisible web of code that developers often don't fully understand or monitor.

Here's the danger: **if even one of those packages has a security vulnerability, your entire application could be at risk** — and you might not even know it. It's like buying a house without inspecting the foundation.

Keeping track of all these packages manually is nearly impossible. Developers need to know:
- Which packages have known security flaws?
- Which packages are so outdated that nobody is maintaining them anymore?
- Which problems should be fixed first?
- How do you actually fix them?

**DepShield solves all of this automatically**, saving developers hours of manual research and protecting their projects from hidden security threats.

---

## How It Works — Step by Step

Here's what happens from start to finish when someone uses DepShield:

### Step 1: The User Provides a Project to Scan
The user has two options:
- **Paste a GitHub link** — They copy-paste the web address of any public project hosted on GitHub (a popular platform where developers store code).
- **Upload a file** — They drag-and-drop or browse for their project's dependency list file (called `package.json` or `package-lock.json`), which is essentially the "ingredients list" of their project.

### Step 2: DepShield Fetches the Project
If a GitHub link was provided, DepShield downloads a lightweight copy of the project behind the scenes. It then locates the dependency list file within that project. If the user uploaded a file directly, this step is skipped.

### Step 3: The Dependency Tree Is Built
DepShield reads the dependency list and maps out every single package the project uses — not just the ones the developer added directly, but also the packages that *those* packages depend on (called "transitive dependencies"). Think of it like tracing a family tree: you don't just look at the parents, you look at grandparents, great-grandparents, and so on.

### Step 4: Codebase Usage Scan
If the project was downloaded from GitHub, DepShield also scans the actual source code files to figure out **which packages are actively being used** in the code and how heavily. This adds valuable context — a vulnerability in a package you use everywhere is more urgent than one in a package you barely touch.

### Step 5: Vulnerability Check
DepShield sends the list of all discovered packages to the **OSV (Open Source Vulnerabilities) database** — a free, public database maintained by Google that tracks known security problems in open-source software. It checks every single package against this database in bulk for speed.

### Step 6: Package Health Check
Simultaneously, DepShield queries the **npm Registry** (the world's largest collection of JavaScript packages) to gather metadata about each package: What's the newest version? When was it last updated? Who maintains it? Is it still actively developed, or has it been abandoned?

### Step 7: Risk Scoring
DepShield combines all the data — vulnerabilities, how outdated a package is, whether it's still maintained, and how deeply nested it is in the dependency tree — into a single **risk score** (0 to 10) for each package. It then classifies each package into severity levels: Critical, High, Medium, Low, or Safe.

### Step 8: Fix Recommendations Are Generated
For every risky package, DepShield generates a specific, actionable fix command that the developer can copy and run immediately. It also suggests **safer alternative packages** when available (for example, suggesting "dayjs" as a replacement for the outdated "moment" library).

### Step 9: Results Are Displayed
The user is presented with a stunning, interactive dashboard showing everything — overall health grade, severity breakdown, vulnerability details, a visual dependency map, and a prioritized fix plan. An animated pipeline shows each analysis step completing in real time, giving the user a sense of the depth of the scan.

---

## APIs & Data Sources Used

| API / Data Source | What Data It Provides | Why It's Needed |
|---|---|---|
| **OSV API** (by Google) — `api.osv.dev` | Known security vulnerabilities (CVE IDs, severity scores, descriptions) for any open-source package and version | This is the core security intelligence engine. It tells DepShield which packages have known exploits and how dangerous they are. |
| **npm Registry** — `registry.npmjs.org` | Latest available version, last update date, license, description, number of maintainers | Used to determine if a package is outdated, abandoned, or still actively maintained — all key risk factors beyond just known vulnerabilities. |
| **GitHub Raw Content** — `raw.githubusercontent.com` | The project's dependency list files (`package.json`, `package-lock.json`) directly from a GitHub repository | Allows DepShield to fetch a project's dependency files quickly via the GitHub API without needing to fully clone the repository — especially useful in environments where Git isn't installed. |
| **Git (via GitPython)** | A shallow clone (minimal download) of the full repository | When Git is available, DepShield clones the entire repo to also scan the actual source code for usage patterns — providing richer, more contextual analysis. |

---

## What the User Gets

Once the scan completes, the user has access to four main views:

### 1. Dashboard
- **Overall Health Grade** (A through F) — A single letter grade summarizing the project's security posture, like a report card.
- **Risk Score Gauge** — A visual gauge (0–100) showing the overall safety level.
- **Key Statistics** — Total packages scanned, number of critical vulnerabilities, packages needing upgrades, and abandoned libraries.
- **Severity Breakdown** — Color-coded progress bars showing how many packages fall into each risk category (Critical, High, Medium, Low, Safe).
- **Critical Vulnerabilities List** — A focused list of the most dangerous findings with CVE identifiers and CVSS danger scores.
- **Abandoned Libraries Section** — Cards highlighting packages that are no longer maintained by anyone.

### 2. Dependency Graph
- An **interactive, force-directed visualization** — a visual map where each package is a node (dot) connected by lines showing relationships. The user can click on any node to inspect it. Color and size indicate severity and importance. It's like looking at a constellation map of the entire project's dependencies.

### 3. Vulnerability Directory
- A **sortable, filterable table** listing every single dependency with its name, current version, latest version, severity level, danger score, number of known exploits (CVEs), and maintainer status. Users can filter by severity level and sort by any column to quickly find what matters most.

### 4. Fix Plan (Remediation Protocol)
- A **prioritized, numbered list** of every package that needs fixing, ranked from most dangerous to least. Each entry shows:
  - The current vulnerable version crossed out, with the safe target version highlighted.
  - The severity badge and difficulty level (Easy, Medium, Hard).
  - A description of the vulnerability.
  - A **ready-to-copy terminal command** to fix the issue (e.g., `npm install axios@1.6.2`).

### 5. Detail Panel
- Clicking on any package anywhere opens a **slide-in side panel** with deep details:
  - All known exploit IDs (CVE numbers).
  - Full vulnerability description.
  - A visual CVSS score gauge.
  - **Origin Trace** — shows exactly how this package entered the project (e.g., "your project → webpack → lodash"), so the developer knows *why* this dependency exists.
  - **Codebase Context** — shows how many files import this package and smart recommendations tailored to the project type.
  - **Breakage Risk** indicator — warns if upgrading might break things.
  - The fix command with a copy button.
  - Safer alternative package suggestions with install commands.
  - A **Generate Pull Request** feature that creates a ready-to-use code diff for the fix.

---

## Tech Stack (Simplified)

| Technology | What It Does (In Simple Terms) |
|---|---|
| **React** | The framework that builds the user interface — everything you see and interact with on screen. |
| **Vite** | A development tool that makes the app load and update extremely fast during development. |
| **Tailwind CSS** | A styling toolkit that makes it easy to design a polished, modern-looking interface quickly. |
| **GSAP** | An animation library that powers all the smooth transitions, fade-ins, and visual effects throughout the app. |
| **Lucide React** | Provides the clean, consistent icons used throughout the interface (shields, warning triangles, arrows, etc.). |
| **React Force Graph 2D** | Renders the interactive dependency map — the constellation-style visualization of packages and their connections. |
| **Flask (Python)** | The backend framework — the behind-the-scenes server that handles data fetching, analysis, and communicates with external databases. |
| **GitPython** | A Python tool that allows the backend to download (clone) GitHub repositories for scanning. |
| **Requests (Python)** | A Python tool for making web requests — used to talk to the OSV vulnerability database and the npm registry. |
| **Axios** | A JavaScript tool used on the frontend to communicate with the Flask backend. |

---

## Why It's Useful / Impact

### Who Benefits?

- **Individual Developers** — Can instantly see if their personal projects have hidden security risks, without needing to be a cybersecurity expert.
- **Development Teams** — Can integrate DepShield into their workflow to catch vulnerabilities before shipping code to production.
- **Open-Source Maintainers** — Can audit their projects and demonstrate to users that their code is secure and well-maintained.
- **Students & Educators** — Provides a visual, intuitive way to learn about software supply chain security.

### Why It Matters

Software supply chain attacks are one of the **fastest-growing cybersecurity threats** in the world. High-profile incidents like the Log4Shell vulnerability (which affected millions of systems worldwide) have shown that a single vulnerable dependency can have catastrophic consequences. 

DepShield makes the invisible visible. Instead of trusting that everything is fine, developers can **see exactly what's inside their project, know what's broken, and get step-by-step instructions to fix it** — all in under a minute. It turns a complex, tedious security audit into a simple, one-click experience with clear, actionable results.

---

*DepShield — Because you can't protect what you can't see.*
