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

Desde la raíz del repositorio, instala las dependencias y crea los archivos de configuración locales:

```sh
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`npm install` normalmente se ejecuta una sola vez. Repítelo si clonas el proyecto
de nuevo, borras `node_modules` o cambian `package.json` o `package-lock.json`.

Configura `REDIS_URL` en `server/.env` y asegúrate de que Redis esté iniciado. Los puertos y orígenes permitidos también se leen de esos archivos. Para probar desde otro dispositivo en la red local, agrega el origen del cliente —incluida su IP y puerto— a `CLIENT_ORIGINS` en `server/.env`. Los archivos `.env` están ignorados por Git.

Inicia el cliente y el servidor juntos:

```sh
npm run dev
```

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

Los bots consultan una tabla de decisiones contextual antes de planificar cada orden. La tabla agrupa la situación por ronda, territorio, tropas, fábricas y recursos; registra los intentos y resultados de cada tipo de acción, y usa una recompensa terminal para favorecer decisiones que ayudan a ganar la partida completa, no solo una ronda: +100 para el primer lugar, +40 para el segundo, -25 para el tercero y -60 para el cuarto. La memoria se guarda compactada en `server/data/bot-decision-memory.json`: conserva las tres mejores variantes de cada tipo de acción por contexto y usa arrays numéricos para ocupar menos espacio. Se carga al iniciar el servidor o el entrenador, por lo que sobrevive a los reinicios. Las partidas normales solo consultan esa memoria: no agregan aprendizajes ni la sobrescriben. El aprendizaje ocurre exclusivamente en sesiones del entrenador. El entrenador compara el modelo guardado antes de entrenar con el modelo resultante usando las mismas semillas de evaluación, informando cambios de victorias y GDI. Las tablas se conservan al reiniciar una sala, con una exploración limitada para descubrir alternativas en partidas de cuatro jugadores. El entrenador usa además las mismas opciones humanas de economía, impuestos, tratados, OI, movimientos navales, capital y órdenes militares.

La memoria del campeón y la de aprendizaje tienen funciones distintas. El archivo
`server/data/bot-training-memory.json` conserva todos los experimentos, incluso los
fallidos, entre generaciones y sesiones. Los candidatos parten de ese aprendizaje;
rechazar una candidata no borra lo que se probó. Este archivo nunca se carga para
jugar: las partidas normales usan exclusivamente `bot-decision-memory.json`, que
solo se reemplaza tras superar selección y confirmación. `RESET_BOT_MEMORY=1`
inicia ambos aprendizajes desde cero. La API permite `trainingMemoryPath` y
`memoryPath` para aislar archivos en pruebas o experimentos.

Las observaciones también alimentan preferencias generales de situaciones de la
misma etapa y cantidades similares, con un peso de referencia limitado a cuatro
observaciones. Así pueden orientar situaciones nuevas sin imponerse a evidencia
específica suficiente. La recompensa terminal se descuenta por rondas transcurridas
(0,97 por ronda), no por cada orden: las decisiones tempranas siguen recibiendo
crédito. Durante la evaluación, exploración cero desactiva tanto el sorteo aleatorio
como el bono de incertidumbre. Los workers reutilizan copias inmutables de los
modelos dentro de cada evaluación, sin retransmitirlas por cada encuentro.

Cada generación entrena candidatos con memorias independientes y los evalúa
contra una liga: el campeón actual, hasta tres campeones históricos y estrategias
fijas económica y agresiva. Los históricos se conservan en
`server/data/bot-league.json` entre sesiones. Cada mapa se juega rotando las
cuatro naciones para cada rival. Las evaluaciones no modifican las memorias.
El mapa y las decisiones usan semillas reproducibles.

Cada candidata incorpora un descriptor numérico versionado (`action.features`):
fuerzas enviadas, defensa visible, proporción de fuerzas, bajas y supervivientes si
la defensa permanece; reservas propias ya comprometidas; protección y amenazas
visibles en el origen (incluidas diagonales); población, capitales, ciudades,
recursos y producción del destino; costos separados de Plata, Materiales e
Influencia; efecto de impuestos y tratados que se romperían. Las estimaciones de
combate no consultan órdenes de otros países ni garantizan qué harán sus tropas.

Un resumen categórico acotado de esos atributos distingue las situaciones en la
tabla actual. Las cifras exactas alimentan un evaluador lineal de jugadas: sus pesos se aprenden
con regresión regularizada sobre los resultados observados, sin asignar premios
manuales a una característica concreta. El modelo usa características numéricas normalizadas e indicadores del tipo de
acción. Aprende del resultado final descontado por ronda y de la señal intermedia,
ponderando cada resultado de jugador por igual para que emitir más órdenes no
le dé mayor peso. Sus estadísticas se acumulan entre generaciones y se combinan
sin duplicar al padre de los candidatos. La puntuación aprendida se mezcla con
la memoria tabular; su influencia crece con la experiencia y disminuye cuando
hay mucha evidencia específica en la tabla. La exploración y la búsqueda corta
siguen siendo etapas separadas de la elección.

El evaluador se serializa en el campo opcional `actionModel` de los archivos de
memoria. El modelo del campeón solo se reemplaza junto a una candidata que supere
selección y confirmación; la evaluación y las partidas normales no ajustan pesos.
Los archivos antiguos, sin modelo, siguen funcionando con la tabla. Los pesos
nuevos se aprenden en próximos entrenamientos: no se pueden reconstruir a partir
de estadísticas antiguas que no guardaban descriptores numéricos.

Si falta una entrada nueva,
se consultan las claves anteriores y sus preferencias generales, manteniendo la
compatibilidad con el campeón guardado. Los historiales internos con descriptores
no se transmiten en el estado público de la partida.

Los bots generan varias ubicaciones de construcción y reclutamiento, destinos
de movimiento (incluidos refuerzos y pasos diagonales legales), alternativas
navales y cantidades. La memoria distingue cantidades, impuestos, tratados,
resoluciones, terreno, frontera, defensa y edificios del destino, sin memorizar
coordenadas. Las entradas anteriores por tipo siguen sirviendo como referencia.

El candidato recibe 3/2/1/0 puntos según su posición y se compara con el campeón
en exactamente los mismos mapas, asientos y rivales. Solo se promueve si supera
al campeón tanto en selección como en una confirmación con mapas nuevos, fuera
del entrenamiento y de la selección. Una muestra pequeña todavía puede ser ruido;
la promoción no certifica nivel humano.

Las simulaciones usan un pool de workers: los candidatos aprenden por separado
y los encuentros de evaluación se distribuyen entre procesos de ejecución de
Node. El orden de finalización no cambia el resultado. Con `BOT_WORKERS=1` se
puede ejecutar en serie. Se descarta un candidato cuando ni ganando todas las
partidas restantes podría superar el puntaje requerido. Es un límite matemático
conservador, no una estimación estadística. `BOT_EARLY_STOP=0` desactiva ese ahorro.

Para ejecutar varias generaciones reproducibles:

```sh
BOT_GENERATIONS=5 BOT_CANDIDATES=3 BOT_GAMES=100 BOT_EVALUATION_GAMES=20 BOT_WORKERS=4 BOT_SEED=123 npm run train:bots --workspace=server
```

`BOT_EVALUATION_GAMES` cuenta mapas por rival: con los tres rivales iniciales
son 12 encuentros por mapa para cada candidato y para la referencia del campeón.
Los históricos aumentan ese número; la confirmación tiene su propio presupuesto
igual de mapas cuando hay un candidato que supera la selección. No se ejecutan
simulaciones adicionales solo para métricas informativas. `BOT_EVALUATION_BATCH`
(predeterminado: 8) controla cuántos encuentros se programan antes de revisar el
descarte temprano. Valores menores permiten detener antes; valores mayores pueden
aprovechar más workers.

La exploración dirigida toma la mejor jugada según la memoria y prueba cantidades
vecinas (±1 y ±20%), validando cada alternativa. Durante la exploración, el 70% de
las veces se priorizan esas variantes cuando existen. La exploración general sigue
activa para descubrir otras estrategias.

El entrenador también reparte entre las decisiones de cada ronda el cambio de
una valoración acotada de ingresos fiscales, fábricas, tropas, territorios valiosos
y GDI. Las diferencias se telescopan: esta señal auxiliar tiene un rango de 10
puntos frente a los 100 de la victoria final. Solo se registra al entrenar.

Antes de ejecutar una orden, los bots pueden simular hasta tres alternativas con
el motor real y proyectar una ronda de economía. Las simulaciones son copias
independientes, no leen las órdenes privadas de los rivales ni escriben experiencias
o memoria. Es una búsqueda de un turno propio con economía siguiente: no modela
la respuesta del rival. Durante la exploración se respeta la jugada exploratoria.
La búsqueda agrega costo de cómputo y no garantiza una mejora de resultados.

`BOT_SEARCH_WIDTH=0` desactiva la búsqueda; su valor predeterminado es 3.
`BOT_DIRECTED_EXPLORATION=0` y `BOT_INTERMEDIATE_REWARDS=0` permiten desactivar las
otras mejoras para hacer comparaciones. Estos parámetros también están disponibles
en `settings` de `trainBots()` como `botSearchWidth`, `botDirectedExploration` y
`botIntermediateRewards`.

Para comparar el sistema completo contra una referencia con esas tres funciones
desactivadas, sin modificar la memoria del campeón ni la liga:

```sh
BOT_GAMES=10 BOT_EVALUATION_GAMES=3 BOT_MAX_ROUNDS=10 BOT_CANDIDATES=2 BOT_WORKERS=2 BOT_SEED=123 npm run benchmark:bots --workspace=server
```

Ambos comandos usan `server/src/training/runBotTraining.js`: el modo normal
entrena y la opción `--benchmark` ejecuta la comparación. También puedes usar
`npm run train:bots --workspace=server -- --benchmark`.

El benchmark usa el mismo presupuesto de partidas y semillas de entrenamiento,
pero no exige igual tiempo de cómputo. Enfrenta ambos modelos promovidos contra
los mismos rivales, rotando naciones en mapas excluidos de entrenamiento,
selección y confirmación. Guarda victorias, puntos y velocidad en
`server/data/bot-benchmark-latest.json` (o `BOT_BENCHMARK_OUTPUT`). Muestras pequeñas
no establecen significancia estadística ni equivalencia con jugadores humanos.

El código de entrenamiento se organiza en cinco archivos: `BotTrainer.js`
coordina las simulaciones y evaluaciones; `BotMemoryStore.js` guarda y carga
memorias, campeones históricos y experiencias humanas; `TrainingPool.js` y
`TrainingWorker.js` ejecutan las tareas en paralelo; `runBotTraining.js` reúne
los comandos de entrenamiento y benchmark. Cada conjunto de datos conserva su
archivo y formato actual.

La API `trainBots()` es asíncrona: debe llamarse con `await`. También permite
configurar `historyLimit` (predeterminado: 3) y `leaguePath`.
`BOT_MAX_ROUNDS` permite acortar las partidas (el juego aplica sus límites).
`BOT_PERSIST=0` permite una prueba desde memoria vacía sin guardar memoria ni liga.
Se evalúa la memoria compactada que usarán los bots al cargarla, evitando promover
una variante que solo funciona antes de guardarse.

Para comenzar una memoria nueva una sola vez, ejecuta
`RESET_BOT_MEMORY=1 npm run train:bots --workspace=server`; las siguientes sesiones
normales continúan desde el campeón guardado.

El entrenamiento no requiere tener el servidor encendido ni ejecutar `npm install`
en cada sesión. Después de instalar las dependencias, basta con ejecutar:

```sh
npm run train:bots --workspace=server
```

Durante la sesión, la consola muestra el avance de entrenamiento, evaluación y
confirmación. Al finalizar informa los encuentros y puntos del candidato, su tasa
de victorias, candidatos descartados, duración y partidas simuladas por segundo.
Los puntajes de candidatos descartados se etiquetan como parciales.
El GDI y los resultados por nación incluyen a todos los participantes de los
encuentros y son informativos; la promoción usa los puntos del asiento candidato.
El valor predeterminado es 100 partidas de aprendizaje por candidato, 100 mapas
de evaluación, una generación, un candidato y cuatro workers en la CLI.
Para comenzar con una sesión corta:

```sh
BOT_GENERATIONS=3 BOT_CANDIDATES=2 BOT_GAMES=30 BOT_EVALUATION_GAMES=10 BOT_WORKERS=4 BOT_SEED=123 npm run train:bots --workspace=server
```

Las decisiones humanas se guardan en `server/data/human-bot-experiences.json`
como hipótesis para explorar, no como ejemplos que deban imitarse. Que una orden
se ejecute correctamente no demuestra que sea buena: no concede recompensa ni
modifica las estadísticas de la memoria. Los registros nuevos conservan también
cantidades y parámetros; los antiguos siguen sirviendo como ideas de tipos de acción.
Las ideas repetidas se deduplican para que la frecuencia humana no otorgue más peso.

Solo durante el aprendizaje se prueban variantes humanas en contextos similares,
con destinos del mapa actual y validación de legalidad. Dentro de la exploración,
se reserva la mitad de los sorteos guiados para esas hipótesis y se mantiene la
exploración general. Las cantidades sugeridas se evalúan al ejecutarse en partidas
simuladas; reciben las mismas recompensas intermedias y finales que cualquier
alternativa del bot, sin bonificaciones por su origen. No se usan ideas humanas
en la evaluación ni en las partidas normales. La candidata solo reemplaza al
campeón si supera selección y confirmación independiente.

Este cambio se aplica a los entrenamientos siguientes. No borra la memoria ya
entrenada ni permite separar retrospectivamente qué parte de sus estadísticas
provino de las antiguas bonificaciones humanas.

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

Publica el backend y el cliente por separado. Configura estas variables en Render:

- En el servicio Node del backend, define `REDIS_URL`, `CLIENT_ORIGINS` y `HOST=0.0.0.0`. Render proporciona `PORT` automáticamente. `CLIENT_ORIGINS` debe contener el origen del sitio del cliente, por ejemplo `https://tu-cliente.onrender.com`.
- En el servicio estático del cliente, define `VITE_SERVER_URL` con la URL HTTPS del backend. Vite incorpora esta URL durante la compilación; no es un secreto.

Para compilar manualmente con otra URL de backend:

```sh
VITE_SERVER_URL=https://tu-servidor.example npm run build --workspace=client
```

Publica el contenido de `client/dist` en un servicio de hosting estático y mantén accesible el backend por HTTPS.

## Estructura del proyecto

| Ruta | Contenido |
| --- | --- |
| `client/src/ui/screens/GameScreen.js` | Coordina la partida y sincroniza la interfaz con el estado recibido. |
| `client/src/ui/screens/LobbyScreen.js` | Menú inicial, sala, perfil y confirmación de disponibilidad. |
| `client/src/ui/components/` | Piezas reutilizables como historial de eventos y botón «Listo». |
| `client/src/ui/styles/GameScreen.css` | Estilos de la interfaz de juego y el lobby. |
| `server/src/game/GameState.js` | Estado autoritativo de la partida y delegación a motores de dominio. |
| `server/src/game/` | Motores de acciones, economía, diplomacia, finanzas y jugadores. |
| `server/src/game/bots/` | Decisiones, características de acciones, evaluador aprendido y estrategias de aprendizaje de bots. |
| `server/src/network/` | Servidor Socket.IO y administración de salas. |
| `shared/` | Constantes y definiciones compartidas entre cliente y servidor. |
| `docs/GAME_DESIGN.md` | Documento detallado de reglas y diseño del juego. |

El proyecto usa npm workspaces. Las dependencias de cliente y servidor se instalan desde la raíz con `npm install`.

## Reglas y diseño

Consulta el [documento de diseño del juego](./docs/GAME_DESIGN.md) para las reglas detalladas de economía, combate, diplomacia, Organización Internacional, mapa e interfaz.
