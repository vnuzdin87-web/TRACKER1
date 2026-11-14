@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "TRACKER_PORT=5173"
set "TRACKER_URL=http://127.0.0.1:%TRACKER_PORT%/"
set "TRACKER_ADMIN_URL=http://127.0.0.1:%TRACKER_PORT%/admin"

echo.
echo  ============================================
echo   Анонимный трекер оценок партнёра
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [Ошибка] Node.js не найден.
  echo  Установите Node.js 20+ с https://nodejs.org/ и запустите файл снова.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo  [Ошибка] npm не найден. Переустановите Node.js.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { $client = New-Object Net.Sockets.TcpClient; $client.Connect('127.0.0.1', %TRACKER_PORT%); $client.Close(); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo  Трекер уже запущен. Открываю браузер...
  start "" "%TRACKER_URL%"
  exit /b 0
)

if not exist "node_modules\.bin\vite.cmd" (
  echo  Первый запуск: устанавливаю зависимости...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [Ошибка] Не удалось установить зависимости.
    echo  Проверьте интернет и права на папку проекта.
    echo.
    pause
    exit /b 1
  )
)

echo  Запускаю трекер: %TRACKER_URL%
echo  Админка:        %TRACKER_ADMIN_URL%
echo  Браузер откроется автоматически.
echo  Если браузер не открылся, откройте %TRACKER_URL% вручную.
echo.
echo  При первом запуске в этом окне будет показан логин
echo  и пароль первого администратора. Сохраните их.
echo.
echo  Чтобы остановить трекер, закройте это окно
echo  или нажмите Ctrl+C.
echo.

call npm run dev

if errorlevel 1 (
  echo.
  echo  [Ошибка] Не удалось запустить сервер.
  echo  Проверьте, что порты %TRACKER_PORT% (Vite) и 3001 (API)
  echo  свободны и не заняты другой программой.
  echo.
  pause
)

endlocal
