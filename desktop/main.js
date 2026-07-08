// Electron entry point — wraps the same web front-end into a native desktop window.
const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#0b2447",
    title: "Bharath Bank of India",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true },
  });

  Menu.setApplicationMenu(null); // clean, app-like chrome
  win.loadFile(path.join(__dirname, "..", "public", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
