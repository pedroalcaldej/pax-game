# PAX

## Iniciar en desarrollo

Se recomienda arrancar el servidor y el cliente en terminales separadas para evitar
mezclar logs y poder detener cada proceso por separado.

### Terminal 1: servidor

Abre una terminal nueva y ejecuta:

```sh
cd /Users/pedroalcalde/repos/pax-game
npm install --prefix server
npm start --prefix server
```

Esto levanta el backend en el puerto `3000`.

### Terminal 2: cliente

Abre otra terminal distinta y ejecuta:

```sh
cd /Users/pedroalcalde/repos/pax-game
npm install --prefix client
npm run dev --prefix client -- --host 0.0.0.0
```

Luego abre la URL que muestra Vite en el navegador. Normalmente será algo como:
`http://localhost:5173`.

### Cómo jugar

Al abrir la web, pulsa «Jugar» para iniciar la primera ronda. Hasta entonces la
partida permanece en espera y no corre el reloj. Cada país comienza con 100 de
plata; los países sin jugadores conectados quedan bajo control de bots.

Las acciones territoriales se pueden ejecutar durante la fase 2, tras seleccionar
una casilla propia y cumplir los requisitos que indica cada botón. «Mover tropas»
requiere seleccionar luego una casilla terrestre adyacente como destino.

### Detener los procesos

En cada terminal, presiona `Ctrl + C` para detener el servidor o el cliente.

### Jugar desde otra máquina en la misma red

Para jugar desde otros dispositivos en la misma red, usa la URL de red del equipo
que ejecuta el servidor y permite el acceso al puerto `3000` de ese equipo. El
cliente se conecta por defecto al puerto `3000` del mismo host desde el que se abrió
la web; para otra ubicación, configura `VITE_SERVER_URL` al ejecutar el cliente,
por ejemplo:

```sh
cd /Users/pedroalcalde/repos/pax-game
VITE_SERVER_URL=http://192.168.1.20:3000 npm run dev --prefix client -- --host 0.0.0.0
```

Si la máquina que ejecuta el servidor no está en la misma red, o si estás usando
otro puerto, también podés ajustar la URL del cliente a mano en la configuración
correspondiente del proyecto.