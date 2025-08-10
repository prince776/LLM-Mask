import {  session } from 'electron'
import {SERVER_URL} from "../types/config";

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
export async function getCookieHeader () {
  const defaultSession = session.defaultSession;
  const cookies = await defaultSession.cookies.get({ url: SERVER_URL });
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  return {
    'Cookie': cookieString,
  }
}
