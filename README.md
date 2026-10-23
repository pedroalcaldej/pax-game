# PAX

## Iniciar en desarrollo

Inicia el servidor y el cliente en terminales separadas:

```sh
npm start --prefix server
npm run dev --prefix client -- --host 0.0.0.0
```

Abre la URL que muestra Vite. Para jugar desde otros dispositivos en la misma red,
usa esa URL de red y permite el acceso al puerto `3000` del equipo que ejecuta el
servidor. El cliente se conecta por defecto al puerto `3000` del mismo host desde
el que se abrió la web; para otra ubicación, configura `VITE_SERVER_URL` al
construir el cliente, por ejemplo `http://192.168.1.20:3000`.

Las acciones territoriales se pueden ejecutar durante la fase 2, tras seleccionar
una casilla propia y cumplir los requisitos que indica cada botón. «Mover tropas»
requiere seleccionar luego una casilla terrestre adyacente como destino.

Al abrir la web, pulsa «Jugar» para iniciar la primera ronda. Hasta entonces la
partida permanece en espera y no corre el reloj. Cada país comienza con 100 de
plata; los países sin jugadores conectados quedan bajo control de bots.