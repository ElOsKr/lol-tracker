// How the app behaves around the League client starting.

// Show the window when the client appears. Off by default: auto-start puts the
// app in the tray precisely so that signing in to Windows doesn't put a window
// in front of whatever you sat down to do, and this is the opposite, so it is
// something to ask for rather than something to discover.
export const OPEN_ON_CLIENT_SETTING = "open_on_client";

// The switch the combined desktop shortcut carries: start in the tray and open
// League straight after, so one click does both.
export const LAUNCH_LEAGUE_FLAG = "--launch-league";
