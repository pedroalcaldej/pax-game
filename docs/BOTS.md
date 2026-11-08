# Bots y entrenamiento de PAX

Esta guía reúne el funcionamiento de la IA, sus archivos de memoria y los comandos de entrenamiento. Para instalar y ejecutar el proyecto, consulta el [README](../README.md). Las reglas de las partidas están en [GAME_DESIGN.md](GAME_DESIGN.md).

## Contenido

- [Decisiones durante la partida](#decisiones-durante-la-partida)
- [Memorias y persistencia](#memorias-y-persistencia)
- [Liga y evaluación reproducible](#liga-y-evaluación-reproducible)
- [Características y evaluador de acciones](#características-y-evaluador-de-acciones)
- [Selección y promoción del campeón](#selección-y-promoción-del-campeón)
- [Paralelismo y descarte temprano](#paralelismo-y-descarte-temprano)
- [Comandos de entrenamiento](#comandos-de-entrenamiento)
- [Exploración, recompensas y búsqueda](#exploración-recompensas-y-búsqueda)
- [Benchmark](#benchmark)
- [Archivos, API y operación](#archivos-api-y-operación)
- [Experiencias humanas](#experiencias-humanas)

## Decisiones durante la partida

Los bots generan alternativas legales de construcción, reclutamiento, movimientos, economía y diplomacia. Consultan una tabla contextual, un evaluador aprendido y una búsqueda corta para elegir sus órdenes. El contexto resume ronda, territorio, tropas, fábricas y recursos; las acciones distinguen cantidades y características del destino sin memorizar coordenadas.

La recompensa terminal por posición es **+100, +40, −25 y −60**, respectivamente. Se favorecen resultados de la partida completa y no solo de una ronda. La memoria del campeón se guarda compactada: conserva las tres mejores variantes por tipo de acción y contexto, con arrays numéricos para reducir su tamaño.

El servidor carga el campeón al iniciar. Las partidas normales consultan la memoria sin actualizarla ni sobrescribirla; conservan una exploración limitada. El aprendizaje y la comparación de modelos ocurren en el entrenador, utilizando semillas reproducibles y las mismas reglas del motor para las acciones que genera la IA.

## Memorias y persistencia

| Archivo en `server/data/` | Uso |
| --- | --- |
| `bot-decision-memory.json` | Campeón que consultan las partidas normales. |
| `bot-training-memory.json` | Experimentos de aprendizaje, incluso candidatos no promovidos. |
| `bot-league.json` | Campeones históricos para evaluación. |
| `human-bot-experiences.json` | Decisiones humanas usadas como hipótesis durante el aprendizaje. |
| `bot-benchmark-latest.json` | Resultado de la última comparación de variantes. |

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

## Liga y evaluación reproducible

Cada generación entrena candidatos con memorias independientes y los evalúa
contra una liga: el campeón actual, hasta tres campeones históricos y estrategias
fijas económica y agresiva. Los históricos se conservan en
`server/data/bot-league.json` entre sesiones. Cada mapa se juega rotando las
cuatro naciones para cada rival. Las evaluaciones no modifican las memorias.
El mapa y las decisiones usan semillas reproducibles.

## Características y evaluador de acciones

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

## Selección y promoción del campeón

El candidato recibe 3/2/1/0 puntos según su posición y se compara con el campeón
en exactamente los mismos mapas, asientos y rivales. Solo se promueve si supera
al campeón tanto en selección como en una confirmación con mapas nuevos, fuera
del entrenamiento y de la selección. Una muestra pequeña todavía puede ser ruido;
la promoción no certifica nivel humano.

## Paralelismo y descarte temprano

Las simulaciones usan un pool de workers: los candidatos aprenden por separado
y los encuentros de evaluación se distribuyen entre procesos de ejecución de
Node. El orden de finalización no cambia el resultado. Con `BOT_WORKERS=1` se
puede ejecutar en serie. Se descarta un candidato cuando ni ganando todas las
partidas restantes podría superar el puntaje requerido. Es un límite matemático
conservador, no una estimación estadística. `BOT_EARLY_STOP=0` desactiva ese ahorro.

## Comandos de entrenamiento

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

## Exploración, recompensas y búsqueda

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

## Benchmark

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

## Archivos, API y operación

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

## Experiencias humanas

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

El uso de ideas humanas como hipótesis se aplica a los entrenamientos siguientes. No borra la memoria ya
entrenada ni permite separar retrospectivamente qué parte de sus estadísticas
provino de las antiguas bonificaciones humanas.
