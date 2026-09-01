# CLIENT OPERATIONS SYSTEM — PRODUCT & IMPLEMENTATION SPEC

## Instructions for Codex

Read this entire document before making any implementation decisions.

For the first step, work in **PLAN MODE only**.

Do not write application code yet.

First:

1. Inspect the existing repository.
2. Understand the current stack and structure.
3. Compare the repository against this specification.
4. Propose the database and application architecture.
5. Produce an implementation plan divided into small, verifiable phases.
6. Identify ambiguities or risks.
7. Prefer the simplest robust MVP solution.
8. Do not overengineer.

PostgreSQL must be the source of truth for all important business data.

---

# 1. PRODUCT OVERVIEW

We need to build an internal web application for a company that manages multiple clients through a structured delivery process.

A client normally stays with the company for approximately **3 to 4 months**.

During that period, the client progresses through **4 sequential stages**.

Each stage:

- has a defined expected duration;
- contains a set of tasks;
- has its own progress;
- has responsible users and/or teams;
- has start and target dates;
- can be completed before the client advances to the next stage.

The application should allow the team to understand, at a glance:

- every active client;
- which stage each client is currently in;
- how long they have been in that stage;
- when they are expected to move to the next stage;
- whether they are on time or delayed;
- which tasks are pending;
- which tasks are completed;
- who owns each task;
- which team is responsible;
- the overall progress of the client;
- what requires attention today.

The experience should feel like a purpose-built combination of:

- Monday
- ClickUp
- Trello

But substantially simpler.

This is not meant to become a generic project management platform.

It is a specific operating system for this company's client-delivery process.

---

# 2. CORE BUSINESS STRUCTURE

The primary hierarchy is:

Company

→ Clients

→ Client Stage 1

→ Client Stage 2

→ Client Stage 3

→ Client Stage 4

Within each stage:

Stage

→ Tasks

→ Task status

→ Responsible user

→ Responsible team

→ Priority

→ Start date

→ Due date

→ Comments

→ Activity history

Conceptually:

```text
CLIENT
│
├── STAGE 1
│   ├── Task
│   ├── Task
│   └── Task
│
├── STAGE 2
│   ├── Task
│   ├── Task
│   └── Task
│
├── STAGE 3
│   ├── Task
│   ├── Task
│   └── Task
│
└── STAGE 4
    ├── Task
    ├── Task
    └── Task
```

---

# 3. CLIENT LIFECYCLE

A client normally remains active for approximately 3–4 months.

The lifecycle is sequential.

Example:

```text
Client starts
    ↓
Stage 1
    ↓
Stage 2
    ↓
Stage 3
    ↓
Stage 4
    ↓
Completed
```

The exact names and durations of the four stages must be configurable.

Do NOT hardcode business logic around labels such as "Stage 1".

The database should treat stages as configurable records.

---

# 4. STAGE DURATIONS

This is a critical requirement.

Each stage has an **expected duration**.

Example only:

```text
Stage 1 → 14 days
Stage 2 → 30 days
Stage 3 → 30 days
Stage 4 → 21 days
```

These values are examples and must be configurable.

Each stage definition should support at minimum:

- name;
- description;
- position/order;
- default duration;
- active/inactive status.

When a new client starts, the application should generate a timeline based on those durations.

Example:

If a client starts September 1:

```text
Stage 1
Start: Sep 1
Expected end: Sep 14

Stage 2
Expected start: Sep 15
Expected end: Oct 14

Stage 3
Expected start: Oct 15
Expected end: Nov 13

Stage 4
Expected start: Nov 14
Expected end: Dec 4
```

The application should therefore understand both:

### Planned dates

The expected timeline according to the process.

### Actual dates

What really happened with the client.

This distinction is important.

---

# 5. CLIENT-STAGE INSTANCE

Do not only connect a client to a global `stage` record.

Each client needs its own instance of each stage so we can track its individual timeline.

Consider an entity conceptually similar to:

`client_stages`

Possible fields:

```text
id
client_id
stage_id
position

planned_start_date
planned_end_date

actual_start_date
actual_end_date

status

duration_days_snapshot

completed_at
created_at
updated_at
```

The exact schema can be improved during planning.

The important concept is:

A global stage defines the process.

A client_stage records how that particular client moves through that process.

This allows two clients to be in the same stage but have different:

- start dates;
- deadlines;
- progress;
- delays;
- histories.

---

# 6. STAGE STATUS

A client's stage should support statuses such as:

```text
NOT_STARTED
ACTIVE
COMPLETED
```

Potentially:

```text
PAUSED
```

if useful.

Only one stage should normally be `ACTIVE` for a client at any point in time.

Previous stages are normally completed.

Future stages are normally not started.

The system should enforce or safely manage this rule.

---

# 7. MOVING A CLIENT BETWEEN STAGES

Users need to be able to advance a client from one stage to the next.

This should be visually simple.

For example:

```text
Move to Stage 2
```

or

```text
Complete Stage
```

When this happens, the system should carefully update:

Current stage:

- status → COMPLETED;
- actual_end_date;
- completed_at.

Next stage:

- status → ACTIVE;
- actual_start_date.

Client:

- current stage;
- relevant progress/status metadata.

The operation should be transactional.

Do not leave partially updated data if one database write fails.

---

# 8. STAGE COMPLETION RULES

The system should calculate whether a stage is ready to be completed.

At minimum:

```text
completed tasks / total tasks
```

Example:

```text
Stage 2

12 tasks total
10 completed

83% complete
```

However, the MVP should not necessarily block advancement if every task is not completed.

Preferred behavior:

If tasks remain unfinished and the user attempts to complete the stage:

Show a warning such as:

```text
2 tasks are still pending.

Complete this stage anyway?
```

ADMIN users may continue.

The exact permission behavior can be proposed in the plan.

---

# 9. CLIENT TIMELINE

Every client should have a clear visual timeline showing:

```text
Stage 1 → Stage 2 → Stage 3 → Stage 4
```

For each stage show:

- name;
- status;
- planned dates;
- actual dates when available;
- duration;
- progress;
- delayed / on track indicator.

Example:

```text
✓ Discovery
Sep 1 – Sep 14
Completed Sep 13
100%

● Implementation
Sep 15 – Oct 14
Day 18 of 30
65%
On track

○ Optimization
Oct 15 – Nov 13
Not started

○ Closure
Nov 14 – Dec 4
Not started
```

The current stage must be visually obvious.

---

# 10. DELAY / HEALTH LOGIC

The application should identify clients or stages that are behind schedule.

A basic MVP rule could be:

```text
today > planned_end_date
AND stage != COMPLETED
```

Then mark the stage as delayed.

Possible labels:

```text
On track
Due soon
Delayed
Completed
```

Do not store redundant calculated states unless there is a strong reason.

Prefer deriving them from dates/status where practical.

---

# 11. DAYS IN CURRENT STAGE

This is an important operational metric.

For an active stage calculate:

```text
Today - actual_start_date
```

or planned start if actual start is unavailable.

Show information such as:

```text
Day 18 of 30
```

or:

```text
12 days remaining
```

or:

```text
5 days overdue
```

This should be visible from the client list without opening the client.

---

# 12. EXPECTED CLIENT COMPLETION DATE

Because the stages have expected durations, the system should expose a projected or planned client completion date.

Show:

```text
Start date
Expected completion
Current stage
Overall progress
```

Example:

```text
Started
Sep 1

Expected completion
Dec 4

Current stage
Stage 2

Overall progress
43%
```

If stages are delayed, consider separately displaying:

```text
Original expected completion
Current projected completion
```

This can be an enhancement if it increases MVP complexity.

---

# 13. PRIMARY CLIENT LIST VIEW

The **LIST VIEW IS A PRIMARY PRODUCT EXPERIENCE**.

Do not treat it as a secondary admin table.

A manager will likely spend a large portion of their time on this screen.

The client list should answer:

> What is happening with every client right now?

Suggested columns:

```text
Client
Current Stage
Stage Progress
Days in Stage
Stage Deadline
Client Progress
Responsible
Team
Pending Tasks
Next Milestone
Health
Last Activity
```

Example:

```text
Acme Corp
Implementation
65%
Day 18 / 30
Oct 14
43%
Laura
Operations
4 pending
Complete onboarding
On track
2h ago
```

The exact column density should remain visually usable.

---

# 14. CLIENT LIST INTERACTIONS

The list should support:

### Search

Search by:

- client name;
- company;
- responsible user.

### Filters

At minimum:

- current stage;
- client status;
- responsible user;
- team;
- health;
- overdue;
- task status.

### Sorting

At minimum:

- client name;
- current stage;
- stage deadline;
- days in stage;
- overall progress;
- most delayed;
- last activity.

### Quick actions

From the list, consider allowing:

- open client;
- change responsible;
- change team;
- advance stage;
- create task.

Avoid turning every table cell into a complex interactive control.

Keep the experience clean.

---

# 15. SAVED VIEWS — OPTIONAL ARCHITECTURE

Design the system so saved views could be added later.

Examples:

```text
My clients

Delayed clients

Stage 1

Stage 2

Closing this month
```

This does not need to be part of the first MVP unless implementation is simple.

---

# 16. DASHBOARD

After login, show an operational dashboard.

The dashboard should prioritize actionable information rather than decorative charts.

Suggested metrics:

```text
Active clients
Clients on track
Clients delayed
Tasks pending
Tasks overdue
Stages due this week
```

Useful operational sections:

### Needs attention

Clients with:

- overdue stages;
- overdue tasks;
- blocked tasks;
- stage deadlines approaching.

### Upcoming stage transitions

Example:

```text
Acme Corp
Stage 2 ends in 2 days

Nova
Stage 1 ends tomorrow
```

### Recent activity

Examples:

```text
Laura completed "Client onboarding"
Juan moved Acme Corp to Stage 3
Operations changed a due date
```

---

# 17. BOARD VIEW

In addition to the list, include a board view.

The board represents CLIENTS by their current stage.

Columns:

```text
STAGE 1 | STAGE 2 | STAGE 3 | STAGE 4
```

Each card represents one client.

Client card can show:

```text
Client name

Progress
65%

Time in stage
18 / 30 days

Responsible
Laura

Pending tasks
4

Health
On track
```

This gives management a portfolio-level view.

---

# 18. DRAGGING CLIENTS BETWEEN STAGES

Potentially allow an ADMIN to drag a client from one stage column to the next.

This is different from dragging tasks.

If implemented:

Moving a client to another stage is a business event and cannot simply update a `current_stage_id`.

It must correctly update:

- current client_stage;
- previous stage status;
- actual completion date;
- next stage actual start date;
- activity log;
- client current stage.

This should execute transactionally.

Because it changes business state, confirmation may be appropriate.

Example:

```text
Move Acme Corp to Stage 3?

Stage 2 still has 2 unfinished tasks.
```

---

# 19. CLIENT DETAIL PAGE

Clicking a client opens their workspace.

Header:

```text
Client name
Company
Client owner
Team
Status
Start date
Expected completion
Overall progress
```

Below:

## Timeline

Visual four-stage lifecycle.

## Current stage

Show prominently:

```text
Stage 2 — Implementation

Day 18 of 30

12 days remaining

65% complete

4 tasks pending
```

## Tasks

Tasks related to this client.

## Activity

History of important changes.

---

# 20. TASKS

Each task should support fields such as:

```text
id
client_id
client_stage_id

title
description

status
priority

assigned_user_id
assigned_team_id

start_date
due_date
completed_at

sort_order

created_by
created_at
updated_at
archived_at
```

Exact schema should be proposed during planning.

Task statuses:

```text
PENDING
IN_PROGRESS
BLOCKED
COMPLETED
```

UI labels:

```text
Pending
In progress
Blocked
Completed
```

Priorities:

```text
LOW
MEDIUM
HIGH
URGENT
```

---

# 21. TASK LIST

Tasks also need a strong list experience.

Possible columns:

```text
Task
Client
Stage
Status
Responsible
Team
Priority
Start
Due
```

Filters:

```text
Client
Stage
Status
Responsible
Team
Priority
Overdue
```

Useful default views:

```text
My tasks
All tasks
Overdue
Due this week
Completed
```

---

# 22. TASK BOARD

Inside a client, tasks can be visualized as a board when useful.

Potential task board:

```text
Pending | In Progress | Blocked | Completed
```

or grouped by stage.

Determine during planning which approach creates the cleanest UX without duplicating too much functionality.

---

# 23. TASK DRAG AND DROP

This is important.

The user should be able to use the mouse to:

- reorder tasks;
- move a task between statuses where appropriate;
- potentially move tasks between stages;
- reorder client cards when useful.

All meaningful changes must persist to PostgreSQL.

Do not store ordering only in local state.

Consider:

- optimistic updates;
- rollback on failure;
- sort/order strategy;
- transactions;
- concurrency;
- server authorization.

---

# 24. TASK DETAIL PANEL

Clicking a task should open a side panel or modal without losing the current context.

Allow editing:

```text
Title
Description
Status
Priority
Stage
Responsible
Team
Start date
Due date
Comments
Activity
```

Changes should save without a full page refresh.

---

# 25. TEAMS

Create a TEAM entity.

Example teams:

```text
Operations
Design
Commercial
Administration
```

A user can belong to a team.

A task may be assigned:

- to a user;
- to a team;
- or to both.

A client should also be able to have:

- a primary responsible user;
- a primary responsible team.

---

# 26. USERS AND LOGIN

Create a simple authentication system.

Requirements:

- login;
- logout;
- persistent session;
- protected private routes;
- server-side authorization.

User fields should support:

```text
id
name
email
authentication credentials
role
team
active/inactive
created_at
updated_at
```

Initial roles:

```text
ADMIN
MEMBER
```

---

# 27. PERMISSIONS

## ADMIN

Can:

- create users;
- manage teams;
- create clients;
- edit clients;
- archive clients;
- manage stages;
- create tasks;
- edit tasks;
- assign users;
- assign teams;
- move tasks;
- advance clients between stages;
- see all clients.

## MEMBER

Can:

- see permitted clients;
- see tasks;
- update assigned work;
- change task status where authorized;
- comment;
- interact with clients/tasks according to permissions.

Authorization must be enforced on the server.

Do not trust frontend controls for access control.

Design permissions so the system can grow later.

---

# 28. CLIENTS

Suggested client fields:

```text
id
name
company_name
email
phone

status

owner_id
team_id

start_date

current_client_stage_id or equivalent safe model

created_at
updated_at
archived_at
```

Statuses:

```text
ACTIVE
PAUSED
COMPLETED
ARCHIVED
```

Prefer soft deletion / archiving for meaningful business data.

---

# 29. STAGE DEFINITIONS

Create a configurable stage definition entity.

Conceptual structure:

```text
stages

id
name
description
position
default_duration_days
active
created_at
updated_at
```

Seed four default stages.

Do not spread stage-specific logic throughout the codebase.

---

# 30. STAGE TEMPLATES AND TASK TEMPLATES

This is highly valuable.

If new clients usually follow the same process, administrators should not recreate every task manually.

Consider:

```text
stage_templates
task_templates
```

or a simpler schema if appropriate.

For each default stage, define reusable task templates.

When creating a client:

1. create client;
2. create four client_stage instances;
3. calculate planned timeline;
4. create tasks from templates;
5. assign default team/user where configured.

Example:

```text
Stage 1 template

- Gather client information
- Kickoff meeting
- Configure account
- Review initial assets
```

Task templates should remain editable/configurable rather than hardcoded.

---

# 31. CREATE CLIENT FLOW

Suggested client creation flow:

### Step 1 — Basic information

```text
Client name
Company
Email
Phone
```

### Step 2 — Ownership

```text
Responsible user
Responsible team
```

### Step 3 — Timeline

```text
Start date
```

Once the start date is selected, show the expected stage schedule.

Example:

```text
Stage 1
Sep 1 – Sep 14

Stage 2
Sep 15 – Oct 14

Stage 3
Oct 15 – Nov 13

Stage 4
Nov 14 – Dec 4
```

### Step 4 — Create

System creates:

- client;
- client stages;
- planned dates;
- tasks from templates;
- initial activity entries.

---

# 32. PROGRESS CALCULATION

We need two useful progress levels.

## Stage progress

Basic calculation:

```text
completed stage tasks / total stage tasks
```

Example:

```text
8 / 10 = 80%
```

## Client progress

Do NOT simply use current stage number.

Prefer a calculation based on actual completed tasks across all stages:

```text
all completed client tasks / all client tasks
```

or another justified weighted approach.

Codex should explain the recommended approach.

Avoid storing progress percentages if they can be reliably calculated.

---

# 33. CLIENT HEALTH

The system should provide a simple health indicator.

Suggested MVP model:

### On track

Current stage is within planned timeline.

### Due soon

Current stage deadline is approaching.

### Delayed

Current stage planned_end_date has passed and stage is incomplete.

### Completed

Client lifecycle completed.

The exact due-soon threshold should be configurable or simple.

For example:

```text
3 days or less remaining
```

---

# 34. ACTIVITY LOG

The system requires traceability.

Log important events such as:

```text
Client created

Client moved from Stage 1 to Stage 2

Task created

Task status changed

Task completed

Task moved

Responsible user changed

Responsible team changed

Due date changed

Stage completed
```

Activity record should know:

```text
actor/user
action
entity type
entity id
timestamp
previous value when useful
new value when useful
metadata
```

Avoid storing enormous unstructured snapshots unnecessarily.

---

# 35. POSTGRESQL

PostgreSQL is the source of truth.

Design the schema carefully.

Likely entities include:

```text
users
teams
team_memberships if needed

clients

stages
client_stages

tasks

task_templates

comments

activity_logs
```

Potential additional join/configuration tables may be appropriate.

Consider correctly:

- one-to-many;
- many-to-many;
- foreign keys;
- indexes;
- unique constraints;
- ordering;
- cascade behavior;
- archive strategy;
- timestamps;
- transactions.

Avoid unnecessary duplication.

---

# 36. DATABASE CONSTRAINTS TO CONSIDER

Codex should explicitly think through:

- one active client stage per client;
- unique stage position;
- valid task/client_stage relationship;
- users belonging to teams;
- stage sequencing;
- client archive behavior;
- task archive behavior;
- client-stage lifecycle integrity.

Prefer enforcing important invariants at both application and database level where practical.

---

# 37. APPLICATION STACK

First inspect the repository.

If a stack already exists, preserve it unless there is a strong reason not to.

If starting from an empty project, preferred technologies are:

## Frontend

```text
Next.js
React
TypeScript
```

## UI

```text
Tailwind CSS
shadcn/ui or similar
```

## Drag and drop

```text
dnd-kit
```

## Database

```text
PostgreSQL
```

## ORM

Choose between:

```text
Prisma
Drizzle
```

Explain the recommendation.

## Authentication

Choose a secure, simple option compatible with the stack.

Avoid unnecessary infrastructure.

---

# 38. UX / DESIGN DIRECTION

The application is used by non-technical business users.

Design should feel:

- clean;
- B2B;
- modern;
- simple;
- fast;
- operational;
- visually obvious.

Prefer:

- light background;
- strong hierarchy;
- subtle borders;
- clear typography;
- restrained status colors;
- spacious tables;
- useful hover states;
- clear selected states.

Avoid:

- dark developer-style dashboards;
- excessive charts;
- excessive widgets;
- unnecessary configuration;
- complex nested menus.

Desktop is the priority.

Tablet and mobile must remain usable.

---

# 39. NAVIGATION

Suggested sidebar:

```text
Dashboard

Clients

Tasks

Teams

Activity

Administration
```

Bottom:

```text
Profile
Logout
```

Administration should only be visible when authorized.

---

# 40. CLIENTS SECTION

Clients should support at least two views:

```text
List
Board
```

The app should remember the user's current view if simple to implement.

Default recommendation:

**List View**

because this application is operational and managers need to scan many clients quickly.

---

# 41. TASKS SECTION

Tasks should support:

```text
My Tasks
All Tasks
Overdue
Due Soon
Completed
```

These can initially be filters/tabs rather than separate complex pages.

---

# 42. SEARCH

Global or section-level search should allow users to quickly find:

- clients;
- tasks.

Avoid complex full-text infrastructure in the MVP unless necessary.

PostgreSQL search or straightforward indexed search may be sufficient.

---

# 43. RESPONSIVE BEHAVIOR

Desktop is the priority.

On smaller screens:

- tables may become horizontally scrollable or simplified;
- board columns can scroll horizontally;
- task detail uses full-screen sheet/dialog;
- critical information remains visible.

Do not destroy desktop usability to force everything into mobile cards.

---

# 44. FEEDBACK STATES

Every meaningful interaction should provide feedback.

Examples:

### Saving

Immediate UI update where safe.

### Success

Small toast.

### Failure

Clear error.

### Optimistic update failure

Rollback visual state.

### Loading

Skeleton or appropriate loading state.

### Empty state

Explain what the user can do next.

Confirm destructive actions only where useful.

---

# 45. TRANSACTIONS

Use database transactions for operations that update multiple related records.

Especially:

### Create client

Could involve:

- client;
- client stages;
- generated task instances;
- activity log.

### Advance stage

Could involve:

- completing current client stage;
- starting next stage;
- changing client current stage;
- activity log.

These operations must not leave partial state.

---

# 46. PERFORMANCE

Think about:

- appropriate PostgreSQL indexes;
- client list query performance;
- task filtering;
- avoiding N+1 queries;
- pagination if client/task counts grow;
- efficient aggregate progress calculation.

Do not prematurely introduce complicated caching.

---

# 47. SECURITY

At minimum:

- secure authentication;
- protected routes;
- authorization server-side;
- input validation;
- protected API/server actions;
- safe credential handling;
- environment variables;
- no secrets exposed in frontend bundles.

---

# 48. SEED DATA

Create realistic seed data.

At minimum:

```text
5–8 clients
4 stages
20–40 tasks
4–6 users
3 teams
```

Include clients at different lifecycle points:

```text
Client A → Stage 1
Client B → Stage 2
Client C → Stage 2 delayed
Client D → Stage 3
Client E → Stage 4
Client F → completed
```

Include:

- overdue tasks;
- blocked tasks;
- completed tasks;
- different owners;
- different teams.

The seed should make every major UI state visible during development.

---

# 49. MVP SCOPE

The MVP must support:

1. Login
2. Users
3. Teams
4. Four configurable stage definitions
5. Stage default durations
6. Create client
7. Client start date
8. Automatic planned client timeline
9. Client stage instances
10. Current client stage
11. Client list
12. Client board
13. Client detail
14. Days in stage
15. Planned stage deadline
16. On-track/delayed indicator
17. Create tasks
18. Edit tasks
19. Task statuses
20. Task priorities
21. Assign responsible user
22. Assign team
23. Task list
24. Filters
25. Search
26. Reorder/move tasks
27. PostgreSQL persistence
28. Stage progress
29. Overall client progress
30. Advance client between stages
31. Basic activity log
32. Basic responsive behavior
33. Realistic seed data

---

# 50. OUT OF SCOPE FOR INITIAL MVP

Unless already trivial within the current architecture, do not prioritize:

- complex notification system;
- email notifications;
- WhatsApp integration;
- advanced analytics;
- billing;
- client-facing portal;
- complicated role builder;
- custom workflow builder;
- arbitrary number of pipelines;
- AI features;
- real-time collaboration;
- file storage infrastructure;
- complex saved-view builder.

Architect intelligently, but build the actual MVP first.

---

# 51. MOST IMPORTANT PRODUCT SCREENS

Prioritize these screens:

## 1. Login

Simple authentication.

## 2. Dashboard

Operational overview.

## 3. Clients — List

This is one of the most important screens.

## 4. Clients — Board

Clients grouped by current stage.

## 5. Client Detail

Timeline + tasks + stage information.

## 6. Tasks

Cross-client operational task list.

## 7. Teams

Basic team management.

## 8. Administration

Users, stages, templates.

---

# 52. CLIENT LIST — REQUIRED INFORMATION

The client list must make these concepts easy to understand without opening each client:

```text
Client
Stage
Stage progress
Time in stage
Stage deadline
Overall progress
Owner
Team
Open tasks
Health
```

This is more important than adding decorative dashboard charts.

---

# 53. TIMELINE LOGIC — EXAMPLE

Suppose:

```text
Stage 1 = 14 days
Stage 2 = 30 days
Stage 3 = 30 days
Stage 4 = 21 days
```

Client starts:

```text
2026-09-01
```

Expected stage timeline:

```text
Stage 1
2026-09-01 → 2026-09-14

Stage 2
2026-09-15 → 2026-10-14

Stage 3
2026-10-15 → 2026-11-13

Stage 4
2026-11-14 → 2026-12-04
```

If Stage 1 actually finishes on September 18:

We need to make a deliberate architecture decision:

### Option A — Preserve original planned dates

Stage 2 remains planned for September 15.

This makes delay visible.

### Option B — Automatically shift future planned stages

Stage 2 begins September 19 and the rest of the timeline shifts.

### Recommended approach

Preserve an original baseline plan and track actual dates separately.

If useful, calculate a projected completion date independently.

This gives management better visibility into delays.

Codex should validate this recommendation during planning.

---

# 54. BUSINESS QUESTIONS THE ARCHITECTURE MUST ANSWER

The database/application design must make it easy to answer questions like:

```text
Which clients are delayed?

Which clients should change stages this week?

Who is responsible for each delayed client?

How many days has Client X been in Stage 2?

Which Stage 2 clients have overdue tasks?

Which clients are almost finished?

Which tasks are due today?

Which team has the most open tasks?

What happened with this client last week?
```

If the architecture makes these questions difficult to answer, reconsider the model.

---

# 55. PLAN MODE OUTPUT REQUIRED

Do not implement yet.

Return a detailed implementation plan with exactly these sections:

## A. Understanding of the product

Explain what is being built in your own words.

## B. Key domain concepts

Explain:

- client;
- stage definition;
- client stage;
- task;
- planned vs actual dates;
- client lifecycle.

## C. User flows

Describe the main user journeys.

## D. Information architecture

Define screens and navigation.

## E. Database architecture

Propose the PostgreSQL model.

Include:

- tables;
- important fields;
- relationships;
- constraints;
- indexes;
- deletion/archive behavior.

## F. Timeline architecture

Explain exactly how planned stage dates should be generated and preserved.

## G. Stage transition architecture

Explain how a client safely moves from one stage to the next.

## H. Progress calculation

Explain stage progress and overall client progress.

## I. Health / delay calculation

Explain:

- days in stage;
- remaining days;
- overdue days;
- on-track/delayed state.

## J. Application architecture

Explain:

- frontend;
- backend;
- PostgreSQL;
- ORM;
- authentication;
- state management;
- validation.

## K. UI architecture

List the main UI components.

## L. List view architecture

Explain how the primary client list should be implemented efficiently.

## M. Board architecture

Explain the client stage board and any drag/drop behavior.

## N. Task architecture

Explain task list, task detail and task movement.

## O. Permissions model

Explain ADMIN and MEMBER authorization.

## P. Activity log architecture

Explain how meaningful changes are recorded.

## Q. Transaction boundaries

Identify which workflows must use PostgreSQL transactions.

## R. Implementation phases

Divide development into small, testable phases.

Do not build everything in one phase.

## S. Files to create or modify

After repository inspection, identify likely files/directories.

## T. Risks and architectural decisions

Identify important tradeoffs before coding.

## U. Acceptance criteria

Create an objective checklist for the MVP.

## V. Recommended implementation order

Give the exact recommended build sequence.

---

# 56. IMPLEMENTATION PRINCIPLES

Follow these principles throughout the project:

1. PostgreSQL is the source of truth.
2. Do not use hardcoded mock data as a substitute for persistence.
3. Keep stage definitions configurable.
4. Separate stage definitions from client-stage instances.
5. Preserve planned timeline data.
6. Track actual dates separately.
7. Use transactions for lifecycle changes.
8. Enforce authorization server-side.
9. Optimize for business users, not developers.
10. Make the client list exceptionally useful.
11. Prefer simple architecture over unnecessary abstractions.
12. Build and verify incrementally.
13. Do not overengineer for hypothetical future requirements.
14. Every major state change should be traceable.
15. Important drag/drop changes must persist immediately.

---

# 57. AFTER THE PLAN

Do not begin coding automatically.

After producing the plan, stop.

Wait for an implementation instruction.

The intended development process after approval is:

```text
Implement Phase 1 only.

Verify Phase 1 against its acceptance criteria.

Fix problems.

Then proceed to the next phase.
```

Do not implement multiple major phases at once unless explicitly instructed.
