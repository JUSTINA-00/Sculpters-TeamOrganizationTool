# Sculptors — Team Organization Tool

A real-time distributed team collaboration app built with React, Firebase, and Tailwind CSS.

## Features

- **Tasks** — Create, assign, filter, and complete tasks with tags (Design / Dev / PM / Bug)
- **Team Chat** — Real-time messaging with avatars and timestamps
- **Docs** — Collaborative documents with auto-save
- **Meetings** — Schedule meetings, RSVP, sorted chronologically
- **Team** — Create or join teams with 6-character join codes; leader approval flow

## Setup

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. The Firebase project (`sculptors-ecf98`) is already configured in `firebase-applet-config.ts`.  
   No additional setup is needed to run the app.

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Firebase Setup (if forking)

If you clone this project with your own Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** → Email/Password
3. Enable **Firestore Database**
4. Deploy the security rules from `firestore.rules`
5. Update `firebase-applet-config.ts` with your project's config

## Project Structure

```
src/
  App.tsx          — All UI components and business logic
  firebase.ts      — Firebase initialization
  types.ts         — TypeScript types
  constants.ts     — Colors, tags, emoji options
  index.css        — Tailwind + global styles
  main.tsx         — React entry point
firebase-applet-config.ts  — Firebase config
firestore.rules             — Firestore security rules
```

## Build

```bash
npm run build
```