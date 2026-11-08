# PAX

Juego de estrategia geopolítica para cuatro países, con planificación simultánea por rondas, economía, combate terrestre y naval, tratados y votaciones en la Organización Internacional (OI). Se puede jugar solo contra bots o compartir una sala con otros jugadores. El servidor valida las acciones y mantiene el estado de la partida.

## Documentación

| Documento | Para qué sirve |
| --- | --- |
| [README](README.md) | Instalar, ejecutar, conectar dispositivos, configurar y publicar el proyecto. |
| [Reglas y diseño](docs/GAME_DESIGN.md) | Aprender a jugar y consultar economía, combate, diplomacia, OI, mapa y victoria. |
| [Bots y entrenamiento](docs/BOTS.md) | Entender la IA, sus memorias, el entrenamiento y las evaluaciones. |

## Contenido

- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Configuración del entorno](#configuración-del-entorno)
- [Primeros pasos para jugar](#primeros-pasos-para-jugar)
- [Multijugador en la misma red](#multijugador-en-la-misma-red)
- [Salas, guardado y reconexión](#salas-guardado-y-reconexión)
- [Comandos de desarrollo](#comandos-de-desarrollo)
- [Publicación](#publicación)
- [Dónde cambiar las reglas](#dónde-cambiar-las-reglas)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Solución de problemas](#solución-de-problemas)

## Requisitos

- Node.js compatible con Vite 8: `20.19+` en la rama 20 o `22.12+` en las ramas posteriores.
- npm con soporte de workspaces; se instala junto con Node.js.
- Una URL de Redis configurada para arrancar el servidor. Las salas multijugador necesitan que Redis esté accesible. Si falla la conexión, el backend sigue escuchando, pero el lobby queda indisponible hasta recuperarla.
- Un navegador con JavaScript habilitado.

## Instalación y ejecución

Ejecuta estos comandos desde la raíz del repositorio:

```sh
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Copia los ejemplos solo la primera vez: si ya tienes archivos `.env`, conserva tu configuración. Estos archivos están ignorados por Git.

Configura `REDIS_URL` en `server/.env`. El ejemplo usa `redis://127.0.0.1:6379`, que requiere un Redis local escuchando en ese puerto. También puedes usar la URL de tu instancia administrada.

Inicia ambos servicios:

```sh
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). Con los ejemplos de configuración, Vite sirve el cliente en `5173` y Node sirve el backend en `3000`. La terminal distingue ambos procesos; `Ctrl + C` los detiene.

`npm install` instala dependencias: no inicia el juego ni asigna direcciones IP. Repítelo cuando cambien las dependencias o falte `node_modules`. Para iniciar una sesión de desarrollo basta con `npm run dev`.

## Configuración del entorno

### Servidor: `server/.env`

| Variable | Ejemplo | Función |
| --- | --- | --- |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Conexión del lobby. No se publica en el cliente. |
| `PORT` | `3000` | Puerto HTTP y Socket.IO. |
| `HOST` | `0.0.0.0` | Interfaces donde escucha el servidor; permite acceso desde la red local. |
| `CLIENT_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Orígenes permitidos, separados por comas, con protocolo y puerto. |
| `ALLOW_LAN_ORIGINS` | `true` | Permite también orígenes de localhost y redes privadas; útil al cambiar la IP local. En producción usa `false` y declara los orígenes del cliente. |

Redis admite conexiones `redis://` y `rediss://`. Para hosts de Upstash, el adaptador usa HTTPS y toma el token de la contraseña incluida en `REDIS_URL`.

### Cliente: `client/.env`

| Variable | Ejemplo | Función |
| --- | --- | --- |
| `VITE_CLIENT_PORT` | `5173` | Puerto del servidor de desarrollo; si está ocupado, Vite falla en lugar de cambiarlo. |
| `VITE_CLIENT_HOST` | `0.0.0.0` | Dirección de escucha configurada para desarrollo. El script `dev` también pasa `--host 0.0.0.0`. |
| `VITE_SERVER_PORT` | `3000` | En desarrollo, conecta al backend con el mismo nombre de host o IP con que se abrió el cliente. |
| `VITE_SERVER_URL` | `https://tu-backend.example` | URL completa del backend; obligatoria para compilar producción. Si se define, tiene prioridad sobre la dirección local. |

Las variables `VITE_*` se incorporan al cliente: no pongas contraseñas ni credenciales en ellas. Reinicia el servicio después de cambiar su `.env`; si cambias `VITE_SERVER_URL` para producción, recompila el cliente.

## Primeros pasos para jugar

1. Abre el cliente e introduce tu nombre y color.
2. Elige una partida individual o crea/únete a una sala con su código.
3. Antes de iniciar, el anfitrión puede elegir el preset Corto, Largo o Personalizado. En Personalizado se editan rondas, tiempo de planificación, cantidad de órdenes, frecuencia de la OI, mapa y semilla.
4. En una sala, cada humano pulsa **Listo**. Cuando todos confirman, comienza la partida; los países restantes los controlan bots.
5. Selecciona una casilla en el mapa y usa el inspector. Las órdenes se guardan en los espacios de acción; puedes reemplazarlas o vaciarlas durante la planificación. Para mover tropas, elige origen, cantidad y destino.
6. Ajusta impuestos y usa finanzas y diplomacia durante la planificación. Esas operaciones son inmediatas. Desmovilizar tropas y desmantelar fábricas también son inmediatos y no consumen órdenes.
7. Pulsa **Listo** al terminar tus decisiones. La resolución comienza cuando todos los participantes activos están listos o se agota el tiempo.

Por defecto, una partida corta tiene **15 rondas**, **30 segundos** de planificación, **3 órdenes por país** y mapa de **20×20**. Se gana por GDI al finalizar el número de rondas. Las capitales se pueden conquistar y perder la capital elimina al país.

Las reglas completas y ejemplos están en [GAME_DESIGN.md](docs/GAME_DESIGN.md). Los controles de música y efectos permiten regular sus volúmenes por separado; las preferencias se guardan en el navegador.

## Multijugador en la misma red

Ejecuta `npm run dev` en **un solo computador**. Todos deben abrir la misma dirección **Network** que muestra Vite, por ejemplo `http://192.168.1.7:5173/`, y unirse a la misma sala. Si cada computador inicia su servidor, son instancias independientes.

- En el computador servidor puedes usar `http://localhost:5173/`.
- En teléfonos u otros computadores usa la IP del computador servidor. `localhost` en esos dispositivos apunta a ellos mismos.
- Estar en la misma Wi-Fi no significa tener la misma IP. El router normalmente asigna una a cada dispositivo mediante DHCP y puede cambiarla al reconectarse o renovar su asignación.
- Si cambia la IP, actualiza el enlace guardado. Una reserva DHCP en el router permite conservar la dirección de ese computador en esa red.
- Con `ALLOW_LAN_ORIGINS=true`, los orígenes privados se aceptan sin añadir cada IP a `CLIENT_ORIGINS`. Si lo desactivas, declara el origen exacto del cliente.

Para comprobar el backend, abre `http://IP_DEL_SERVIDOR:3000/health`. Una respuesta con Redis disponible es:

```json
{"ok":true,"service":"pax-game-server","redisConnected":true}
```

`redisConnected:false` indica que el backend responde pero Redis no está disponible. La dirección privada solo sirve dentro de la red local; para jugar por Internet utiliza un cliente y un backend publicados.

## Salas, guardado y reconexión

| Situación | Comportamiento |
| --- | --- |
| Sala multijugador | Redis conserva perfiles, códigos, disponibilidad, reservas de países y chat. Sus datos caducan tras siete días sin actualización. |
| Partida multijugador activa | El tablero y el reloj viven en el proceso Node; Redis no guarda todo el estado de la partida. |
| Desconexión en multijugador | Se reserva el país para reconectar; la partida de los demás continúa. |
| Partida individual | Se pausa al desconectarse, cambiar de pestaña o perder el foco. Al volver conserva país, órdenes y tiempo restante. |
| Guardado individual | El servidor guarda al iniciar, pausar y finalizar en `server/data/solo-games/`, ignorado por Git. Permite recuperar la sesión tras cerrar el navegador o reiniciar el servidor si se conserva ese directorio. |
| Pausa manual | Se mantiene hasta pulsar Reanudar, aunque la ventana vuelva a tener foco. |
| Volver al menú principal | Abandona la partida individual y elimina su guardado. |

Los archivos de memoria de bots tienen otro propósito: consulta [Bots y entrenamiento](docs/BOTS.md). Las partidas normales consultan el modelo guardado; el aprendizaje ocurre en el entrenador.

## Comandos de desarrollo

Todos se ejecutan desde la raíz:

| Comando | Resultado |
| --- | --- |
| `npm install` | Instala las dependencias de ambos workspaces. |
| `npm ci` | Instala exactamente el lockfile; útil en CI y despliegues. |
| `npm run dev` | Inicia cliente y servidor juntos. |
| `npm run dev --workspace=client` | Inicia solo Vite. |
| `npm run dev --workspace=server` | Inicia solo el backend, con reinicio al cambiar código. |
| `npm start --workspace=server` | Inicia el backend sin modo de vigilancia. |
| `npm test --workspace=server` | Ejecuta las pruebas de Node. No hay script `test` en la raíz. |
| `npm audit` | Consulta vulnerabilidades de dependencias. |
| `npm run train:bots --workspace=server` | Ejecuta entrenamiento de bots; puede actualizar archivos de memoria. |
| `npm run benchmark:bots --workspace=server` | Compara variantes del sistema de bots. |

Para ejecutar solo las pruebas de límites y resoluciones:

```sh
node --test server/test/OILimits.test.js server/test/InternationalOrganizationEngine.test.js
```

Los parámetros, ejemplos y efectos del entrenamiento se explican en [BOTS.md](docs/BOTS.md).

## Publicación

El backend Node y el cliente estático se publican por separado.

| Servicio | Instalar | Compilar | Iniciar / directorio publicado |
| --- | --- | --- | --- |
| Backend | `npm ci` | No requiere compilación | `npm start --workspace=server` |
| Cliente | `npm ci` | `npm run build --workspace=client` | `client/dist` |

Estos comandos suponen que la raíz del servicio es la raíz del repositorio.

En el backend configura `REDIS_URL`, `HOST=0.0.0.0` y `CLIENT_ORIGINS` con el origen HTTPS del cliente. Usa `ALLOW_LAN_ORIGINS=false`. Proporciona `PORT` mediante el entorno; Render lo asigna automáticamente. El backend debe admitir conexiones Socket.IO y ser accesible por HTTPS.

En el cliente define `VITE_SERVER_URL` con la URL HTTPS del backend **antes de compilar**. Ejemplo manual:

```sh
VITE_SERVER_URL=https://tu-backend.example npm run build --workspace=client
```

Publica `client/dist`. El cliente compilado no obtiene una nueva URL de backend por cambiar una variable después: hay que reconstruirlo.

Para conservar partidas individuales tras reinicios del hosting, preserva `server/data/solo-games/` en almacenamiento persistente. La persistencia del lobby Redis no recupera por sí sola un tablero multijugador perdido al reiniciar Node.

## Dónde cambiar las reglas

Los valores compartidos se encuentran en [shared/Constants.js](shared/Constants.js). Los cambios requieren reiniciar el servidor y reconstruir o recargar el cliente según el entorno; no recalculan necesariamente los efectos ya aprobados en una partida guardada.

| Configuración | Qué controla |
| --- | --- |
| `DEFAULT_GAME_SETTINGS`, `GAME_SETTINGS_PRESETS`, `GAME_SETTINGS_LIMITS` | Valores iniciales, presets y rangos permitidos de partidas. |
| `ECONOMY.STARTING_RESOURCES`, `POPULATION`, `ROUND_PRODUCTION` | Recursos, población, crecimiento e ingresos. |
| `ECONOMY.COSTS`, `REWARDS`, `NAVAL`, `GROUND_TRANSPORT` | Precios, recompensas y capacidad/alcance de transporte. |
| `ECONOMIC_POLICY` | Rango de impuestos y tasa inicial. |
| `OI_RESOLUTION_DURATION_ROUNDS` | Duración de las resoluciones: **5 turnos completos** posteriores a la aprobación. |
| `ECONOMY.OI_LIMITS` | Máximos de **20 tropas y 20 fábricas**, **1 ronda de gracia** y multas de **2 y 5 de Plata** por unidad excedente. |

Los tratados diplomáticos ordinarios y el plazo de bonos usan `TREATY_DURATION_ROUNDS` en `server/src/game/GameStateUtils.js`; su plazo no depende de la duración de las resoluciones de la OI.

## Estructura del proyecto

| Ruta | Responsabilidad |
| --- | --- |
| `client/src/ui/screens/` | Pantalla de partida y lobby. |
| `client/src/ui/components/` | Mapa, inspector, finanzas, diplomacia e historial. |
| `client/src/ui/styles/` | Estilos de la interfaz. |
| `client/src/audio/`, `client/public/audio/` | Reproducción, música y efectos. |
| `client/src/network/` | Socket.IO, sesiones y lobby del cliente. |
| `server/src/game/GameState.js` | Estado de la partida y delegación a motores. |
| `server/src/game/` | Acciones, rondas, economía, diplomacia y finanzas. |
| `server/src/game/bots/` | Decisiones y evaluación de bots. |
| `server/src/training/` | Entrenador, workers, almacenamiento de modelos y benchmark. |
| `server/src/network/` | Socket.IO, Redis, salas y guardados. |
| `server/test/` | Pruebas del motor, red y componentes compartidos con el cliente. |
| `shared/` | Reglas, constantes, protocolos y cálculos compartidos. |
| `docs/` | Reglas del juego y guía de bots. |

## Solución de problemas

| Síntoma | Qué comprobar |
| --- | --- |
| Falta una variable al arrancar | Crea los dos `.env` desde sus ejemplos y comprueba los nombres de las variables. |
| Vite no inicia o avisa de versión de Node | Ejecuta `node --version` y comprueba los requisitos de Vite 8. |
| El puerto `5173` está ocupado | Detén la instancia anterior o cambia `VITE_CLIENT_PORT`; actualiza también el origen permitido si corresponde. |
| Abre el cliente pero no conecta | Comprueba el backend en `/health`, `VITE_SERVER_PORT` o `VITE_SERVER_URL`, y los orígenes permitidos. |
| Otro dispositivo no puede entrar | Comprueba misma red, IP actual del servidor, firewall y ausencia de aislamiento entre clientes Wi-Fi. |
| Fallan las salas o el chat | Comprueba `redisConnected` en `/health` y la conexión configurada en `REDIS_URL`. |
| La compilación exige `VITE_SERVER_URL` | Define la URL del backend antes de ejecutar el build. |
| `npm install` muestra vulnerabilidades | Consulta `npm audit`; revisa la actualización y su compatibilidad antes de usar `--force`. Los avisos de financiación o scripts de instalación son mensajes distintos. |
| Una acción está deshabilitada | El tooltip indica el motivo: fase, dueño, terreno, recursos, órdenes reservadas o restricciones aplicables. El servidor valida de nuevo al ejecutar. |
