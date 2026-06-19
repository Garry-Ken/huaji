// Electron 桌面外壳：把打包好的网页 (dist) 装进一个原生窗口。
// 用于生成 Mac (.dmg) 和 Windows (.exe) 安装包。
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 430,
    height: 860,
    minWidth: 360,
    minHeight: 600,
    title: '花迹 · 智能记账',
    backgroundColor: '#fbfbfd',
    webPreferences: { contextIsolation: true },
  })
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  // PayPal / GitHub 等外部链接用系统浏览器打开，而不是在 App 窗口里
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
