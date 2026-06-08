const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function startServer() {
  // Path to the compiled server inside dist
  const serverPath = path.join(__dirname, 'dist', 'server.cjs');
  
  // Set production environment variables
  process.env.NODE_ENV = 'production';
  process.env.PORT = '3000';
  
  // Fork the Node process to execute server.cjs
  serverProcess = fork(serverPath, [], {
    env: { ...process.env }
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start local background server:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "NEXUS POS PRO",
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Attempt to load the page with retries and timeout
  let attempts = 0;
  const maxAttempts = 15; // 15 seconds max wait

  const loadURL = () => {
    mainWindow.loadURL('http://localhost:3000').then(() => {
      console.log('Page loaded successfully');
    }).catch((err) => {
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`Server not ready yet (attempt ${attempts}), retrying in 1s...`);
        setTimeout(loadURL, 1000);
      } else {
        console.error('Final failure to load server:', err);
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURI(`
          <html>
            <body style="background: #0f172a; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden;">
              <div style="text-align: center; padding: 40px; border: 1px solid #1e293b; border-radius: 12px; background: #1e293b;">
                <h1 style="color: #ef4444;">Erreur de Démarrage</h1>
                <p>Le serveur local n'a pas répondu à temps.</p>
                <div style="margin: 20px 0; padding: 10px; background: #000; border-radius: 6px; font-family: monospace; font-size: 12px;">${err.message}</div>
                <button onclick="window.location.reload()" style="background: #6366f1; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Réessayer</button>
              </div>
            </body>
          </html>
        `));
      }
    });
  };

  // Start polling almost immediately
  setTimeout(loadURL, 500);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  // Make sure to kill the background Express server process when Electron quits
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
