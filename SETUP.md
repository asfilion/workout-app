# Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli` (or use `npx expo`)
- For iOS builds: Expo account (free) at https://expo.dev

## Local Development

```bash
# Install dependencies
npm install

# Start Metro bundler
npx expo start
```

Use Expo Go on your iPhone (scan QR code) or press `i` for iOS simulator (macOS only).

## Building for iOS

This project uses Expo's EAS Build service to compile iOS builds from Windows.

### First-time setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to Expo
eas login

# Configure build
eas build:configure
```

### Create a build

```bash
# Development build (for testing)
eas build --platform ios --profile development

# Production build
eas build --platform ios --profile production
```

### Requirements for iOS distribution

- Apple Developer account ($99/year) for App Store / TestFlight
- EAS handles code signing automatically
- No macOS required for building — EAS builds run on Apple hardware in the cloud

## Project Structure

```
src/
  components/     # Reusable UI components (TimerDisplay)
  db/             # SQLite schema, initialization, query modules
  navigation/     # Tab + stack navigators
  screens/        # All app screens
  stores/         # Zustand state stores
  types/          # TypeScript type definitions
  utils/          # Unit conversion, time formatting, CSV export
```

## Offline

The app is fully offline. All data is stored locally in SQLite on-device. No network requests are made.
