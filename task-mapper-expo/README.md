# Task Mapper — React Native + Expo

Responsive task manager for Android, iOS and desktop browsers. The UI adapts to phone, tablet and wide desktop screens.

## Features
- **Kanban Board with Direct Stage Moves**: Bidirectional movement buttons (`← To do`, `→ In progress`, `→ Complete`), WIP limit alerts, and pin to top.
- **Card Quick Actions**: Pin tasks (`📌`), toggle high priority (`★`), and duplicate tasks (`⧉`) directly from the card.
- **Subtasks & Checklists**: Add child checklist steps with interactive checkboxes and micro progress bars.
- **Bilingual Voice Parsing (English + Hindi)**: Natural speech extraction recognizing Hindi terms:
  - Dates: *aaj* (आज), *kal* (कल), *agle hafte* (अगले हफ्ते).
  - Priority: *zaroori* / *khaas* (जरूरी / खास $\rightarrow$ High), *aam* / *samanya* (Medium), *kam zaroori* (Low).
  - Categories: *pariyojana* (परियोजना) or *project*.
- **Multi-Dimensional Filters & Sorting**: Filter by Priority (High/Medium/Low), Timeline (Overdue/Today/This week), and Project. Sort by Due Date, Priority, or Newest.
- **Productivity Metrics & Overdue Alert**: Live completion progress bar, stage counts, and overdue warning alert.
- **Data Portability & Offline Persistence**: Local AsyncStorage persistence, one-click JSON Backup Export, JSON Restore/Import, Undo Delete toast banner, and Starter Demo Data onboarding.

## Requirements
Install Node.js LTS and npm.

## Run on PC (browser)
```bash
npm install
npm run web
```
Open the URL Expo prints in Chrome or Edge. Browser voice recognition requires browser support and microphone permission.

## Run on mobile
```bash
npm install
npx expo start
```
Use the QR code or run `npm run android` / `npm run ios`. The native speech-recognition module may require a custom development build rather than Expo Go.

## Platform note
This is one React Native codebase targeting native Android/iOS and a responsive web build for PC. It is not yet packaged as a standalone Windows `.exe`; that requires a separate Windows packaging/build step. iOS local builds require macOS/Xcode.

## Storage and privacy
Tasks are stored on the current device/browser. No account, backend, or cloud sync is configured. Voice recognition behavior and internet requirements depend on the platform/browser.
