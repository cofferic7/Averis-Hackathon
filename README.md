# ShipOps — AI-Assisted Shipping Document Review

ShipOps is a hackathon project designed to make shipping email and document review faster and easier.

The application helps users classify shipping-related emails, identify cases that require human attention, compare **Shipping Instructions (SI)** with **Bills of Lading (BL)**, and keep track of completed reviews.

## Project Overview

Shipping teams may receive many emails and documents that need to be checked manually. ShipOps provides a simple review workflow where users can focus on cases that need attention.

The current interface supports:

- Email classification into different shipping-related categories.
- A **Review Queue** for document cases that require human review.
- Detection and display of differences between Shipping Instructions and Bills of Lading.
- **Needs Review** cases for missing or incomplete information.
- A detailed review page for each email/case.
- Selecting the correct document value when a mismatch is found.
- Adding missing shipping information and reviewer notes.
- A **Resolved Cases** page for completed reviews.
- Search and filtering for review cases.
- Exporting resolved review records.
- Opening a specific review case directly from its email.

## Main Workflow

```text
Shipping Email
      ↓
Email Classification
      ↓
Document Check
      ↓
┌───────────────────┐
│                   │
Mismatch        Needs Review
│                   │
└─────────┬─────────┘
          ↓
     Review Queue
          ↓
   Human Verification
          ↓
     Resolved Cases
```

For document comparison cases, the system can compare information such as:

- Shipper
- Consignee
- Notify party
- Port of loading
- Port of discharge
- Container count
- Gross weight

## Technology

The frontend is built with:

- Next.js
- React
- TypeScript
- CSS
- Browser Local Storage for locally storing resolved review records

The frontend retrieves review results through the project's API layer.

## Prerequisites

Before running the project, install:

- Node.js
- npm
- Git

You can check whether Node.js and npm are installed with:

```bash
node --version
npm --version
```

## Setup Instructions

### 1. Clone the repository

```bash
git clone <https://github.com/cofferic7/Averis-Hackathon.git>
```

### 2. Enter the project folder

```bash
cd Averis-Hackathon
```

If the frontend is inside a separate frontend folder, enter it:

```bash
cd frontend
```

Use the folder that contains `package.json`.

### 3. Install dependencies

```bash
npm install
```

This installs the packages required by the frontend.

### 4. Start the development server

```bash
npm run dev
```

After the server starts, the terminal will show the local address. It is normally:

```text
http://localhost:3000
```

If port 3000 is already being used, Next.js may automatically use another port such as:

```text
http://localhost:3001
```

Open the address shown in your terminal.

## Backend / API

The Review Queue retrieves its data through the project's API helper.

Make sure the backend or API service required by the project is running before testing features that depend on live review results.

If your team uses environment variables for the API URL, create the required `.env.local` file according to your team's configuration.

> Backend setup commands are not included here because they depend on the final backend structure and dependencies used by the team.

## Using the Application

### Dashboard

The dashboard displays classified shipping emails. Emails can be grouped into categories such as:

- Check Document
- New Shipping Instruction
- Invoice Question
- Operational Update
- Spam

For document-check emails, users can open the related review case.

### Review Queue

The Review Queue contains cases with statuses such as:

- `MISMATCH` — the Shipping Instruction and Bill of Lading contain different information.
- `NEEDS_REVIEW` — information is missing, incomplete, unreadable, or requires human checking.

Users can search for a case by email ID or issue and filter the queue by status.

### Reviewing a Mismatch

For a mismatch case:

1. Open the case.
2. Compare the Shipping Instruction and Bill of Lading.
3. Review the fields that are different.
4. Choose whether the SI or BL should be accepted.
5. Add an optional review note.
6. Resolve the case.

### Reviewing Missing Information

For a Needs Review case:

1. Open the case.
2. Check the available SI and BL information.
3. Complete the required information.
4. Add review notes when necessary.
5. Save the review.

### Resolved Cases

Completed mismatch reviews are stored in the browser's Local Storage and displayed on the Resolved Cases page.

The page allows users to:

- Search completed cases.
- Filter by final result.
- View review details.
- See original and final document values.
- Export resolved records as JSON.

Because these records currently use browser Local Storage, they are stored only in that browser and are not a replacement for a production database.


## Hackathon Goal

The goal of ShipOps is to demonstrate how automation can support shipping operations while keeping a human reviewer involved when information is missing, uncertain, or inconsistent.

Instead of requiring users to manually inspect every email and document, the application organizes cases and directs attention to the records that need human verification.

## Future Improvements

Possible future improvements include:

- Persistent database storage for review decisions.
- User authentication and reviewer accounts.
- Real email integration.
- Automatic document extraction.
- More document types.
- Review history and audit logs.
- Notifications for high-priority cases.
- Improved analytics and reporting.
- Deployment to a production environment.

## Contributors

Built as part of the Averis Hackathon project.

Add team member names and roles here:

```text
Eric Yong Wen Jun — Leader
Anson Kua Klin — Member
Chloe Wong Ke En - Member
```
