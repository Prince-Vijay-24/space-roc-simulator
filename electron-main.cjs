const { app, BrowserWindow } = require('electron');
const path = require('path');

const fs = require('fs');

function getIconPath() {
    const candidatePaths = [
        path.join(__dirname, 'public', 'icon.ico'),
        path.join(__dirname, 'public', 'icon.png'),
        path.join(__dirname, 'dist', 'icon.ico'),
        path.join(__dirname, 'dist', 'icon.png'),
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'icon.png'),
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) return p;
    }
    return undefined;
}

function createWindow() {
    const iconPath = getIconPath();

    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        title: 'Space Roc Simulator',
        icon: iconPath,
        autoHideMenuBar: true, // Hides top menus for a clean, full-screen game feel
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the compiled web app
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});