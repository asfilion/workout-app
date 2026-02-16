# Workout Tracker

An offline-first weightlifting tracker for iPhone. Create repeating weekly workouts, log sets quickly during training, and review per-exercise history over time.

## Features

- **Exercise library** -- 22 preloaded exercises, plus create your own
- **Weekly workout templates** -- assign exercises to days of the week (Mon--Sun)
- **Fast set logging** -- weight auto-fills from your last set; one tap to save
- **Dual timers** -- total elapsed time and time since last set, always visible
- **Exercise history** -- per-exercise table of all logged sets, newest first
- **CSV export** -- export all sets to CSV via the iOS share sheet
- **Unit toggle** -- switch between lb and kg at any time (data stored in lb, converted on display)
- **Fully offline** -- no network, no accounts, no cloud. All data on-device in SQLite

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo (SDK 54, managed workflow) |
| Language | TypeScript |
| Storage | expo-sqlite |
| State | Zustand |
| Navigation | React Navigation (bottom tabs + native stacks) |
| Export | expo-file-system + expo-sharing |
| IDs | expo-crypto (UUIDs) |

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **Expo Go** app on your iPhone (free, from the App Store)

### Run Locally

```bash
git clone https://github.com/asfilion/workout-app.git
cd workout-app
npm install
npx expo start
```

Scan the QR code with Expo Go on your iPhone. The app loads over your local network -- no internet required after the initial bundle.

**Limitation:** With this approach, your laptop must be running `npx expo start` whenever you open the app in Expo Go. To use the app without your laptop, see the next section.

## Using with Expo Go (No Laptop Required)

You can publish the app to Expo's update service so Expo Go loads it from the cloud instead of your laptop. This is **completely free** -- no Apple Developer account needed.

### One-Time Setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your free Expo account
eas login

# Initialize EAS Update for the project
eas update:configure
```

### Publish an Update

```bash
eas update --branch main --message "Initial release"
```

This uploads your JS bundle to Expo's CDN.

### Open on Your iPhone

1. Open Expo Go on your iPhone
2. Log in with the same Expo account
3. The project appears under "Projects" on the home screen
4. Tap to launch -- it downloads the bundle once, then runs locally

### How It Works

| | Laptop needed? | Internet needed? | Data persists? |
|---|---|---|---|
| `npx expo start` (dev) | Yes, every launch | No (local WiFi) | Yes |
| `eas update` (published) | No | Only on first load | Yes |

- Your workout data (exercises, sessions, sets) is stored in SQLite **on your iPhone** and persists across app restarts
- After the first load, the app works fully offline -- you can use it in airplane mode at the gym
- To push code changes, just run `eas update` again from your laptop

### Updating the App

After making code changes:

```bash
eas update --branch main --message "description of changes"
```

Next time you open the app in Expo Go, it picks up the new version automatically.

## Building a Standalone App (Optional)

If you want the app to run without Expo Go (its own icon on your home screen, no Expo dependency), you need a standalone `.ipa`. This requires an Apple Developer account ($99/year) for code signing. Expo's **EAS Build** service handles the build from any OS.

### Prerequisites (all platforms)

1. **Expo account** (free): sign up at [expo.dev](https://expo.dev)
2. **Apple Developer account** ($99/year): required for code signing and distribution
3. **EAS CLI**:
   ```bash
   npm install -g eas-cli
   eas login
   ```

### From a Windows Laptop

No macOS required. EAS Build compiles on Apple hardware in the cloud.

```bash
# One-time: configure EAS for this project
eas build:configure

# Build for iOS (runs in the cloud)
eas build --platform ios --profile production
```

EAS will prompt you to set up code signing with your Apple Developer account on the first run. Follow the interactive prompts -- it handles certificates and provisioning profiles automatically.

Once the build finishes, you can:
- Download the `.ipa` from your [Expo dashboard](https://expo.dev)
- Submit to TestFlight: `eas submit --platform ios`
- Submit to the App Store: `eas submit --platform ios`

### From a MacBook

You have two options:

**Option A: EAS Build (same as Windows)**

```bash
eas build:configure
eas build --platform ios --profile production
```

**Option B: Local build (no cloud, faster iteration)**

```bash
# Generate the native Xcode project
npx expo prebuild --platform ios

# Build locally (requires Xcode installed)
eas build --platform ios --local
```

This produces an `.ipa` file on your machine without using the cloud service. Requires Xcode 15+ and CocoaPods.

To run directly on a connected iPhone during development:

```bash
npx expo run:ios --device
```

### Development Builds (Testing)

For a debug build you can install on a physical device (without Expo Go):

```bash
eas build --platform ios --profile development
```

Install the resulting build on your device, then connect to your local dev server with `npx expo start --dev-client`.

## Project Structure

```
src/
  components/     TimerDisplay
  db/             SQLite schema, init, seed, query modules
  navigation/     Tab navigator + stack navigators
  screens/
    workouts/     WorkoutList, WorkoutDetail, WorkoutDayDetail, ActiveSession
    exercises/    ExerciseList, ExerciseDetail
    settings/     SettingsScreen
  stores/         Zustand (settingsStore, sessionStore)
  types/          TypeScript type definitions
  utils/          Unit conversion, time formatting, CSV export
seed/
  exercises.json  Preloaded exercise library
```

## Data Model

All weight is stored canonically in **pounds (lb)** and converted to kg at the display layer.

- **exercises** -- library of available exercises (seed + user-created)
- **workout_templates** -- named workout programs
- **workout_day_templates** -- which exercises on which day (Mon--Sun)
- **workout_sessions** -- individual training sessions with timestamps and status
- **session_set_entries** -- logged sets with weight, reps, and timestamps

See [DECISIONS.md](DECISIONS.md) for architectural rationale.

## License

[MIT](LICENSE)
