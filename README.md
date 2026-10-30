# PAX

Juego de estrategia geopolítica para cuatro países. Combina economía, expansión territorial, diplomacia y votaciones en la Organización Internacional. El servidor valida las acciones y conserva el estado autoritativo de cada partida.

## Contenido

- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Cómo jugar](#cómo-jugar)
- [Multijugador en red local](#multijugador-en-red-local)
- [Salas online con Redis](#salas-online-con-redis)
- [Publicación](#publicación)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Reglas y diseño](#reglas-y-diseño)

## Requisitos

- Node.js y npm instalados.
- Para crear o unirse a salas online: Redis disponible para el servidor.

## Instalación y ejecución

Desde la raíz del repositorio, instala las dependencias e inicia el cliente y el servidor juntos:

```sh
npm install
npm run dev
```

El servidor carga la configuración local desde `server/.env`. Copia el ejemplo y edita la URL si es necesario:

```sh
cp server/.env.example server/.env
npm run dev
```

El valor inicial conecta a Redis en `127.0.0.1:6379`; Redis debe estar iniciado antes de arrancar el servidor. El archivo `server/.env` está ignorado por Git. En Render, define `REDIS_URL` en el entorno del servicio del servidor.

Abre [http://localhost:5173](http://localhost:5173). El cliente Vite usa el puerto `5173` y el servidor Socket.IO el `3000`. Ambos procesos aparecen identificados por color en la terminal. Deténlos con `Ctrl + C`.

Para ejecutar cada servicio por separado:

```sh
npm run dev --workspace=client
npm run dev --workspace=server
```

Para ejecutar el servidor sin el modo de desarrollo:

```sh
npm start --workspace=server
```

## Cómo jugar

En el menú puedes iniciar una partida de un jugador, crear una sala privada o unirte con un código. En el lobby multijugador, el nombre se guarda al presionar Enter o salir del campo, y el color al seleccionarlo. Pulsa **Listo** para confirmar; puedes volver a pulsarlo para retirar la confirmación.

La partida multijugador comienza cuando todos los jugadores humanos están listos. Los espacios restantes se completan con bots. Durante la planificación de cada ronda, la fase avanza cuando todos los humanos vuelven a marcarse listos o al terminar el temporizador.

## Multijugador en red local

Con ambos servicios ejecutándose, abre en cada dispositivo la dirección de red que muestra Vite, por ejemplo `http://192.168.1.7:5173`. El cliente se conecta al servidor del mismo equipo por el puerto `3000`.

Comprueba la conexión desde otro dispositivo en `http://IP_LOCAL_DEL_SERVIDOR:3000/health`; debe responder:

```json
{"ok":true,"service":"pax-game-server"}
```

Si la dirección local no responde, comprueba que los dispositivos estén en la misma red y que el firewall permita conexiones entrantes para Node.js.

## Salas online con Redis

El servidor administra creación, búsqueda, reservas de países, perfiles, disponibilidad y chat de las salas con Redis. Los cambios de lobby se validan en el servidor. Las salas caducan siete días después de su última actualización. El estado de la partida sigue en el proceso del servidor Node.js.

Configura `REDIS_URL` en el entorno del servidor. Acepta URLs `redis://` y `rediss://`; para proveedores administrados, copia la URL privada que entrega el proveedor. No la publiques en el cliente ni en el repositorio.

## Publicación

El backend de referencia está en `https://pax-game.onrender.com`. La URL raíz muestra el estado del servicio; el cliente se publica por separado. En producción, el cliente usa esa URL automáticamente. Para definir otra URL durante la compilación:

```sh
VITE_SERVER_URL=https://tu-servidor.example npm run build --workspace=client
```

Publica el contenido de `client/dist` en un servicio de hosting estático. Mantén accesible el backend por HTTPS y configura `REDIS_URL` en el servicio del servidor.

## Estructura del proyecto

| Ruta | Contenido |
| --- | --- |
| `client/src/ui/screens/GameScreen.js` | Coordina la partida y sincroniza la interfaz con el estado recibido. |
| `client/src/ui/screens/LobbyScreen.js` | Menú inicial, sala, perfil y confirmación de disponibilidad. |
| `client/src/ui/components/` | Piezas reutilizables como historial de eventos y botón «Listo». |
| `client/src/ui/styles/GameScreen.css` | Estilos de la interfaz de juego y el lobby. |
| `server/src/game/GameState.js` | Estado autoritativo de la partida y delegación a motores de dominio. |
| `server/src/game/` | Motores de acciones, economía, diplomacia, finanzas, jugadores y bots. |
| `server/src/network/` | Servidor Socket.IO y administración de salas. |
| `shared/` | Constantes y definiciones compartidas entre cliente y servidor. |
| `docs/GAME_DESIGN.md` | Documento detallado de reglas y diseño del juego. |

El proyecto usa npm workspaces. Las dependencias de cliente y servidor se instalan desde la raíz con `npm install`.

## Reglas y diseño

Consulta el [documento de diseño del juego](./docs/GAME_DESIGN.md) para las reglas detalladas de economía, combate, diplomacia, Organización Internacional, mapa e interfaz.
