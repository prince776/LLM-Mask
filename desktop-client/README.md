# desktop-client

Electron based desktop client for LLM-Tor.

## Development

```bash
$ npm install
```

```bash
$ npm run dev
```

## Build

```bash
# For Linux
./dist linux x64

# For windows
./dist windows x64

# For macOS - M1 chips
./dist mac arm
# For macOS - Intel chips
./dist mac x64

# To notarize mac .dmg:
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"

xcrun notarytool submit dist/llmtor-1.0.0.dmg --apple-id "" --team-id "" --password "" --wait
xcrun stapler staple dist/llmtor-1.0.0.dmg
## verify
hdiutil attach dist/llmtor-1.0.0.dmg
spctl -a -t exec -vv /Volumes/llmtor\ 1.0.0-arm64/llmtor.app
```

## Build without packaging

```
npm run build
```
