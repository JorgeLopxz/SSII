# 🛠️ Hands-Free Workshop Assistant (P2 - Prototipar)

Este proyecto implementa una ecología de dispositivos distribuida para un taller de bricolaje, permitiendo la interacción sin contacto físico mediante comandos de voz, gestos y sensores de movimiento. 

El sistema utiliza **Node.js, Express y Socket.IO** para la comunicación en tiempo real entre un ordenador principal (pantalla/monitor) y un teléfono móvil (sensor de nivelación).

---

## ⚙️ 1. Requisitos Previos e Instalación

Para que cualquier miembro del equipo pueda ejecutar este proyecto en su ordenador, es necesario seguir estos pasos de configuración inicial:

### 1.1. Instalar Node.js
1. Descargar la versión **LTS** desde la [página oficial de Node.js](https://nodejs.org/).
2. Ejecutar el instalador y asegurarse de marcar la opción "Add to PATH" durante el proceso.
3. Reiniciar Visual Studio Code o la terminal tras la instalación.

### 1.2. Solución de permisos en Windows (PowerShell)
Si al ejecutar comandos `npm` aparece un error en rojo indicando que "la ejecución de scripts está deshabilitada", se debe ejecutar el siguiente comando en la terminal de PowerShell (como administrador o usuario actual) y aceptar pulsando la tecla `S` (o `A`):
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
1.3. Instalar las dependencias del proyecto
Una vez clonado este repositorio, abre una terminal en la carpeta raíz del proyecto y ejecuta:

PowerShell
npm install
(Esto instalará Express y Socket.IO automáticamente basándose en el archivo package.json).

🚀 2. Ejecución del Sistema
El sistema requiere levantar el servidor local y, simultáneamente, crear un túnel seguro para que el iPhone pueda enviar los datos de sus sensores.

Paso A: Arrancar el Servidor Backend
Abre una terminal en la raíz del proyecto y ejecuta:

PowerShell
node server.js
Deja esta terminal abierta. El servidor estará escuchando en el puerto 3000.

Vista del PC: Puedes abrir en el navegador de tu ordenador la ruta http://localhost:3000/pc.html para ver el Monitor Principal (Nivel gigante).

Paso B: Crear el túnel seguro (HTTPS) para el iPhone
Debido a las estrictas políticas de seguridad de Apple (iOS 13+), Safari bloquea el acceso al giroscopio si la conexión no es HTTPS. Para solucionarlo, creamos un túnel temporal. Aunque no es necesario haciendo esto en Android te aseguras que funcione correctamente también.

Abre una segunda terminal en VS Code y ejecuta:

PowerShell
npx localtunnel --port 3000
(Si pregunta si deseas instalar el paquete, pulsa y).
La terminal te devolverá una URL segura (por ejemplo: https://palabras-aleatorias.loca.lt).

📱 3. Conectar el iPhone (Modo Sensor)
Con el servidor y el túnel funcionando, sigue estos pasos en el dispositivo iOS:

Abre Safari en el iPhone (evita usar Chrome para esta prueba).

Escribe la URL segura que te dio localtunnel y añade la ruta de la vista móvil al final.

Ejemplo exacto: https://palabras-aleatorias.loca.lt/movil.html

Al ser un túnel gratuito, la primera vez aparecerá una pantalla de advertencia de Localtunnel. Pulsa el botón azul "Click to Continue".

Una vez cargue la interfaz del proyecto, pulsa el botón "Activar Sensores".

Safari mostrará un aviso nativo del sistema solicitando permiso para acceder a "Movimiento y orientación". Pulsa Permitir.

¡Listo! Si mueves el móvil, verás cómo los grados de inclinación se actualizan en la pantalla del iPhone y, simultáneamente, la burbuja del PC se mueve y cambia de color en tiempo real.

🏫 4. Uso en la Red de la Universidad (Eduroam)

El WiFi universitario bloquea las conexiones que necesita `localtunnel`. En ese caso, usa **Cloudflare Tunnel** como alternativa, que funciona sobre el puerto 443 (HTTPS estándar) y no tiene ese problema.

### Paso B alternativo: Crear el túnel con Cloudflare

En lugar del comando de localtunnel, ejecuta este en la segunda terminal:

```powershell
npx cloudflared tunnel --url http://localhost:3000
```

(Si pregunta si deseas instalar el paquete, pulsa `y`).

Espera unos segundos hasta que aparezca un bloque como este en la terminal:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://palabras-aleatorias.trycloudflare.com                                             |
+--------------------------------------------------------------------------------------------+
```

Esa es tu URL segura. Úsala exactamente igual que la de localtunnel:

```
https://palabras-aleatorias.trycloudflare.com/movil.html
```

> **Nota:** Con Cloudflare Tunnel no aparece la pantalla de advertencia intermedia, la página carga directamente.

---

🐛 5. Troubleshooting (Solución de problemas)
La página del móvil se queda en blanco: Asegúrate de haber escrito /movil.html al final de la URL del túnel en Safari.

El PC no se conecta (Firewall): Si estás probando con la IP local (192.168.X.X) en lugar del túnel y no carga, revisa que el Firewall de Windows esté permitiendo conexiones públicas y privadas para "Node.js".