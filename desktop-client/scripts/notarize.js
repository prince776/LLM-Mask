import { notarize } from '@electron/notarize'

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename

  return await notarize({
    tool: 'notarytool',
    appBundleId: 'com.saasflux.llmtor',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })
}
/*
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"

xcrun notarytool submit $LLMTORBIN --apple-id $APPLE_ID --team-id $APPLE_TEAM_ID --password $APPLE_APP_SPECIFIC_PASSWORD --wait
xcrun stapler staple $LLMTORBIN
##VERIFY
hdiutil attach $LLMTORBIN
spctl -a -t exec -vv /Volumes/llmtor\ 1.0.0/llmtor.app
 */
