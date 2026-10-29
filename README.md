# PAX

## 1. Guía para conectarse

### Iniciar en desarrollo

Se recomienda arrancar el servidor y el cliente en terminales separadas para evitar
mezclar logs y poder detener cada proceso por separado.

#### Terminal 1: servidor

Abre una terminal nueva y ejecuta:

```sh
cd /Users/pedroalcalde/repos/pax-game
npm install --prefix server
npm start --prefix server
```

Esto levanta el backend en el puerto `3000`.

#### Terminal 2: cliente

Abre otra terminal distinta y ejecuta:

```sh
cd /Users/pedroalcalde/repos/pax-game
npm install --prefix client
npm --prefix client run dev
```

Luego abre la URL que muestra Vite en el navegador. Para jugar en la misma
computadora puedes usar `http://localhost:5173`; para otros equipos usa la URL
`Network` que muestra Vite, por ejemplo `http://192.168.1.7:5173`.

### Cómo jugar

Al abrir la web, pulsa «Jugar» para iniciar la primera ronda. Hasta entonces la
partida permanece en espera y no corre el reloj. Cada país comienza con 100 de
plata; los países sin jugadores conectados quedan bajo control de bots.

Las acciones territoriales se pueden ejecutar durante la etapa de planificación, tras seleccionar
una casilla propia y cumplir los requisitos que indica cada botón. «Mover tropas»
permite ajustar la cantidad (por defecto, todas las tropas disponibles) antes de
seleccionar una casilla terrestre adyacente como destino. Al ocupar un espacio de
acción, se selecciona automáticamente el otro si está vacío.

### Detener los procesos

En cada terminal, presiona `Ctrl + C` para detener el servidor o el cliente.

### Jugar desde otra máquina en la misma red

Para jugar desde otros dispositivos en la misma red, abre en todos los equipos la
URL `http://IP_LOCAL_DEL_SERVIDOR:5173`. Vite y el servidor escuchan en todas las
interfaces de red. El cliente se conecta automáticamente al puerto `3000` del
mismo host desde el que se abrió la web, por lo que normalmente no hace falta
configurar `VITE_SERVER_URL`.

```sh
cd /Users/pedroalcalde/repos/pax-game
npm --prefix client run dev
```

Para comprobar la conectividad desde otro equipo, visita
`http://IP_LOCAL_DEL_SERVIDOR:3000/health`; debe devolver
`{"ok":true,"service":"pax-game-server"}`.

Si `localhost` funciona pero la IP `192.168.x.x` no responde, permite Node.js
en el firewall de macOS. El modo «Bloquear todas las conexiones entrantes»
impide el acceso LAN aunque Vite y el servidor estén escuchando correctamente:

```sh
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

Acepta las conexiones entrantes cuando macOS lo solicite y vuelve a iniciar
ambos procesos. Si la instalación de Node usa otra ruta, obtén la ruta con
`which node` y reemplaza `/usr/local/bin/node`. Como alternativa, desactiva
temporalmente el firewall desde Configuración del Sistema > Red > Firewall
solo para confirmar el diagnóstico. Verifica también que ambos equipos estén
en la misma red y que no haya una VPN o red Wi-Fi de invitados activa.

Al conectarse una sola persona, la sala conserva los cuatro países y los tres
países sin conexión permanecen bajo control de bots. No hace falta esperar a otros
jugadores para iniciar una partida.

### Salas online con Firebase Realtime Database

El cliente incluye un lobby opcional sincronizado con Firebase usando los SDK
compatibles v10 cargados por CDN, sin añadir dependencias ni un build separado.
Para activarlo:

1. Crea un proyecto gratuito en Firebase.
2. Activa **Authentication > Sign-in method > Anonymous**.
3. Crea una base **Realtime Database** y copia la configuración de la aplicación web.
4. Completa `window.PAX_FIREBASE_CONFIG` en
   [`client/index.html`](./client/index.html).
5. Configura las reglas de la base para exigir autenticación:

```json
{
  "rules": {
    "salas": {
      "$codigo": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

La pantalla inicial permitirá crear una sala o unirse con un código de seis
caracteres. El creador puede iniciar con menos de cuatro personas y las ranuras
restantes se completan con bots; con cuatro personas la sala pasa a `en_juego`
automáticamente cuando el estado de Firebase se sincroniza. Las salas solo
coordinan el lobby: el servidor Node/Socket.IO sigue siendo el propietario del
estado de la partida y debe permanecer ejecutándose.

## 2. Reglas y funcionalidades del juego

### Funcionalidades implementadas

- La partida tiene cuatro países. Los países sin una persona conectada se completan
  y quedan bajo control de bots; al conectarse, cada persona ocupa un país bot libre.
- Al comenzar cada etapa de planificación, los bots ajustan sus impuestos al 15%,
  intentan expandirse a territorio neutral, atacar países más débiles, construir fábricas
  o ciudades y reclutar tropas hasta un máximo de 10 (o el límite de armamento vigente),
  según el territorio y los recursos disponibles. Si no tienen una acción útil y legal
  disponible, dejan el espacio vacío en lugar de simular una orden de mantener posición.
  Después confirman que están listos.
- Los jugadores humanos pueden pulsar «Forzar» para confirmar que terminaron de
  planificar. La confirmación se puede retirar mientras la etapa no haya terminado.
  La etapa avanza cuando todos los jugadores humanos están listos; si no, termina al
  cumplirse su temporizador de 60 segundos. Si una persona se desconecta durante la
  planificación, su país pasa a control de un bot.
- Las órdenes de cada país se planifican en tres espacios y se resuelven al terminar la
  fase. El servidor valida las acciones, el territorio, la fase y los recursos.
- Los controles de zoom permanecen anclados y visibles en el panel del mapa al
  desplazarse. Se puede acercar o alejar con los controles o la rueda, ajustar el mapa
  al panel y arrastrarlo para recorrerlo.
- El movimiento a una casilla enemiga adyacente resuelve combate terrestre: gana el
  atacante solo con superioridad numérica y captura al vencer. Atacar a un firmante de
  un PNA rompe el pacto y sanciona al atacante con 10 de Influencia Política.
- El Mercado Global permite comprar materiales por 3 de plata cada uno y venderlos
  por 1 de plata cada uno. La interfaz presenta un único selector de cantidad con
  controles de decremento, incremento y máximo, seguido de las acciones Comprar y
  Vender.
- Emitir un bono entrega 20 de plata y crea una deuda de 25 con vencimiento cinco
  rondas después de la emisión. Si no se puede pagar el total al
  vencimiento, el jugador pierde 5 de Influencia y la deuda impaga acumula 1 de plata
  de interés al inicio de cada ronda posterior. Los pagos parciales o totales se pueden
  hacer manualmente desde Finanzas; los bonos que sí tienen saldo suficiente se cobran
  automáticamente al vencer.
- El Panel Global muestra los conflictos militares: un combate o la ocupación de
  territorio rival mantiene el estado de guerra durante las últimas tres rondas y
  mientras haya tropas extranjeras en el territorio. No se pueden proponer TLC nuevos
  durante un conflicto; una acción militar rompe de inmediato el TLC activo entre los
  países involucrados.
- Las casillas se resaltan suavemente al pasar el cursor. Todos los botones reproducen
  un sonido breve al pulsarlos.
- El log conserva el historial completo de la partida y se sincroniza
  desde el servidor para que también lo vean quienes se conectan o reconectan después.
  Incluye cambios de ronda como eventos y acciones resueltas con el país que las realiza
  y la casilla correspondiente; no antepone la ronda ni la fase a cada evento. También
  muestra votaciones, conexiones y errores de acciones intentadas, pero no cambios de
  fase, selecciones ni órdenes pendientes.
- En la votación de la OI, los votos a favor o en contra usan por defecto 1 punto de
  Influencia (el mínimo); se puede modificar la apuesta antes de registrar la papeleta.
- La interfaz muestra las cuatro naciones, el estado de la ronda, la fase, los
  recursos y el GDI. El Panel Global reemplaza al Marcador GDI e incluye el desglose
  de países, sus recursos, territorio, población, tropas, ciudades, fábricas e impuestos,
  además de los tratados vigentes y sus propuestas.
- El panel lateral de la nación usa tres pestañas instantáneas: **Economía** para
  impuestos y mercado; **Banca & Diplomacia** para bonos, deuda, donaciones
  y reuniones de la Organización Internacional; y **Log** para eventos y
  advertencias. La cabecera con la nación y el tipo de jugador permanece fija mientras
  se navega por el contenido.
- El bloque del Banco Mundial vive exclusivamente en **Banca & Diplomacia**. El **Log**
  ocupa toda la altura disponible de su pestaña y los encabezados de las secciones
  incluyen un indicador circular `?` con una descripción contextual al pasar el cursor.
- Las operaciones financieras, propuestas diplomáticas y errores de acciones muestran
  Toasts breves sobre la parte superior del mapa. Los mensajes se clasifican por color,
  desaparecen automáticamente después de tres segundos y los controles deshabilitados
  explican mediante tooltip el requisito que falta o la restricción activa.
- La interfaz utiliza una estética de terminal geopolítico minimalista: fondo pizarra
  oscuro, tarjetas elevadas con separadores sutiles, ámbar para finanzas, púrpura
  pastel para la OI, verde suave para acciones positivas, tipografía de sistema y
  datos cuantitativos monoespaciados.
- La partida termina al finalizar la ronda 30 y presenta un resumen con los países
  ordenados por GDI, con el mismo desglose del Panel Global. Desde el resumen se puede
  iniciar otra partida con las personas conectadas o volver al menú principal.
- Durante la etapa de planificación se pueden proponer, aceptar y rechazar pactos
  de no agresión y tratados de libre comercio desde el Panel Global. Quien propone
  puede cancelar su oferta mientras siga pendiente. Los tratados aceptados duran cinco
  rondas desde su activación; el Panel Global muestra las rondas restantes. Firmas,
  expiraciones, cancelaciones y rupturas se registran en el Log. Atacar a un firmante de
  un PNA cancela de inmediato ese pacto y descuenta 10 puntos de Influencia Política al
  atacante, hasta un mínimo de cero. El TLC elimina el arancel bancario del 20% en las
  transferencias directas entre sus firmantes y se rompe al iniciar un conflicto militar.
  Los bots aceptan un PNA cuando el
  país proponente tiene más tropas y comparte frontera; rechazan propuestas sin beneficio
  mecánico.

El documento de diseño completo que sigue reúne las reglas y especificaciones del
juego, incluida la Organización Internacional, sus propuestas y votaciones.

### Game Design Document (GDD) — PAX
**Especificación Técnica y Visual**

---

#### 1. Resumen Ejecutivo y Visión General

**PAX** es un juego de estrategia geopolítica y económica en tiempo real (RTS) para **4 jugadores**, ambientado en un mundo plano en vista cenital 2D (*tilemap*). El juego pone al jugador al mando de un Estado soberano que compite por la hegemonía global en un tablero internacional interconectado, donde la dominación se construye combinando la fuerza militar con el peso institucional y las tensiones se resuelven o escalan tanto en el campo de batalla como en las mesas de negociación.

El objetivo principal de la partida es consolidar a la nación como la potencia dominante del planeta al término de un número fijado de rondas, alcanzando la puntuación más alta en el **Índice de Dominio Global (GDI)**. Dado que las Capitales son sedes políticas inexpugnables y no existe la eliminación de participantes, la victoria no se logra mediante la aniquilación o erradicación de los rivales, sino superándolos en desarrollo económico, capacidad industrial, volumen demográfico, poderío militar y liderazgo diplomático.

##### Pilares Estratégicos

- **Economía:** Es el motor del Estado. Se encarga de la recaudación fiscal en **Plata**, la regulación de la tasa impositiva sobre la población y la producción de **Materiales** mediante industrias. Permite financiar proyectos, edificar defensas y sostener las fuerzas armadas.
- **Política y Diplomacia:** Representa la Proyección de Soberanía e Influencia del país en el escenario multilateral. Utiliza la **Influencia Política** para votar resoluciones vinculantes en la Organización Internacional, gestionar el sistema de Casus Belli y pactar tratados o sanciones.
- **Militar y Control Territorial:** Es la herramienta de defensa y proyección de poder sobre el mapa. Abarca el reclutamiento y movimiento de fuerzas terrestres y navales, la fortificación de posiciones clave y la ejecución de bloqueos estratégicos sobre la infraestructura enemiga.
- **Demografía y Sociedad:** Constituye la base humana y el sustento fiscal de la nación. El volumen de población en las ciudades responde dinámicamente a la presión impositiva, afectando la recaudación a largo plazo y la prosperidad del Estado.

---

#### 2. Estructura de la Partida y Dinámica de Ronda

Las partidas se configuran con un límite cerrado de **20 a 30 rondas** (definible en la sala) y una etapa de planificación de **60 segundos**. Cada ronda sigue estas etapas conceptuales:

1. **Inicio de ronda:** el servidor aplica intereses, vencimientos, producción, recaudación y crecimiento poblacional. Esta etapa es visible y dura brevemente para que Plata, Materiales, Población, Influencia y GDI se actualicen con animaciones count-up.
2. **Planificación:** es la única etapa normal en la que el jugador interactúa. Aquí se gestionan impuestos, mercado, transferencias, bonos, pagos, diplomacia y las órdenes territoriales. Los jugadores pueden confirmar que están listos; si todos lo hacen, la etapa termina antes de los 60 segundos.
3. **Resolución:** el servidor valida y ejecuta automáticamente las órdenes planificadas. Normalmente no se muestra en pantalla; si tarda más de lo esperado, la interfaz informa que está resolviendo acciones.
4. **Cierre:** se presenta el resultado de la resolución durante una ventana breve. Las tropas se animan sobre el mapa, se muestran combates y capturas, y los cambios restantes de recursos se presentan visualmente.
5. **Reunión de la OI:** al cerrar las rondas 5, 10, 15, etc., se intercala una reunión extraordinaria visible e interactiva de hasta 60 segundos antes de iniciar la siguiente ronda. Durante ella no se planifican acciones normales.

Las etapas automáticas no aceptan interacciones del jugador. La planificación concentra todas las decisiones normales y la reunión de la OI es la única excepción interactiva. Las animaciones del inicio y del cierre son presentación visual: las reglas y valores definitivos se calculan y validan en el servidor.

---

#### 3. Sistema Económico, Demografía e Industria

La economía de PAX pivota sobre tres recursos principales: **Plata** (moneda de cambio), **Materiales** (insumo de construcción y reclutamiento) e **Influencia Política** (capital diplomático).

##### 3.1. Mecánica Impositiva y Crecimiento Demográfico

La población de las Ciudades (`CIU`) es el motor fiscal del Estado. Sin embargo, una tasa impositiva alta desincentiva el crecimiento poblacional e induce migración o estancamiento:

1. **Rango Permitido de Impuestos:** La Tasa Impositiva ($\tau \in [0.05, 0.50]$) se fija dentro de un rango obligatorio del **5% al 50%**.
2. **Fórmula de Crecimiento:** La Tasa de Crecimiento ($G$) de la población para la siguiente ronda se calcula mediante la relación recíproca con constante $k = 1$:
   $$G = \frac{1}{100 \times \tau}$$
3. **Actualización de Población:** Al final de cada ronda, la nueva población del Estado se determina aplicando la tasa obtenida sobre la población actual:
   $$\text{Población}_{T+1} = \text{Población}_T \times (1 + G)$$

> **Regla de Jugabilidad:** A menor carga impositiva, la población crece a mayor velocidad, ampliando la base tributaria para rondas futuras. A mayor tasa impositiva, la recaudación por habitante aumenta de inmediato, pero el crecimiento de la población se desacelera hasta alcanzar un mínimo del 2%.

##### 3.2. Infraestructura Industrial

Los Materiales son indispensables para construir defensas y entrenar fuerzas armadas. Se producen mediante:

- **Fábricas (`FT` / `FA`):** Edificaciones industriales construibles tanto en tierra (`FT`) como en agua (`FA`). Aportan **+2 Materiales por turno** y tienen un costo base de **$10 Plata**.
- **Materia Prima (`MPT` / `MPA`):** Yacimientos naturales en tierra (`MPT`) o agua (`MPA`). No producen recursos por sí solas, pero otorgan un descuento especial reduciendo el costo de construcción de una Fábrica a solo **$5 Plata**.

##### 3.3. Emisión de Deuda y Comercio

- **Mercado Global:** Cada jugador puede comprar materiales por **3 de Plata** o
  venderlos por **1 de Plata** cada uno. El sistema neutral no tiene límites de stock.
- **Transferencias directas:** Enviar Plata o Materiales a otro país retiene el **20%**
  como arancel del Banco Mundial, redondeado hacia arriba. El receptor obtiene el resto;
  los TLC activos entre ambos países eliminan el arancel.
- **Emisión de Bonos:** Un bono entrega **20 de Plata** y crea una deuda de **25 de Plata**
  con vencimiento cinco rondas después de la emisión. El saldo se cobra
  automáticamente al vencimiento si hay fondos suficientes. El impago resta
  **5 de Influencia** y añade **1 de Plata** de interés al comienzo de cada ronda
  posterior; se permiten pagos parciales y totales manuales en cualquier momento.
- **Ingreso de Influencia:** al finalizar cada ronda, cada ciudad o capital controlada
  otorga **1 Punto de Influencia Política**. Durante la planificación, el jugador también
  puede donar **15 de Plata al Banco Mundial** para obtener **1 Punto de Influencia**.
- **Tratado de Libre Comercio (TLC):** Acuerdo político de cinco rondas que exime del
  arancel de transferencias directas. Una acción militar contra el firmante rompe el TLC.
  No se permiten nuevos TLC durante una guerra: combate en las últimas tres rondas o
  tropas de un país ocupando territorio del otro.

---

#### 4. Logística y Combate Militar

El combate implementado es terrestre. Las reglas futuras de barcos, transporte de tropas,
escolta comercial y bloqueo costero aún no están activas.

##### Combate terrestre

Las tropas terrestres pueden atacar una casilla terrestre adyacente que pertenezca a otro país. El combate se resuelve al finalizar la fase de planificación; la cantidad de tropas que se envía es la fuerza atacante y se compara con las tropas del país propietario en la casilla defensora. La defensa de la casilla no modifica el cálculo.

- El atacante gana solo si envía **más tropas** que las que defienden la casilla. En un empate, gana el defensor.
- El bando perdedor pierde la mitad de sus tropas, redondeada hacia arriba; las tropas supervivientes permanecen en la casilla donde estaban. Si el bando perdedor tenía una sola tropa, la pierde.
- Si el atacante pierde, sus supervivientes permanecen en la casilla de origen. Si gana, conquista la casilla y mueve allí todas sus tropas atacantes. Las tropas defensoras supervivientes permanecen en ella como fuerzas visitantes; pueden retirarse con una orden de movimiento posterior.
- Atacar a un firmante de un Pacto de No Agresión vigente rompe inmediatamente el
  pacto y descuenta hasta 10 puntos de Influencia Política al atacante. Por ahora no se
  requiere Casus Belli.
- No se aplica la antigua mecánica de bloqueo en dos etapas; el combate y la captura se resuelven en la misma ronda. El movimiento marítimo y el combate naval aún no están implementados.

---

#### 5. Diplomacia, Organización Internacional (OI) y Casus Belli

La Organización Internacional (OI) es la mesa multilateral donde los 4 estados votan resoluciones vinculantes. Las reuniones ocurren **al terminar las rondas 5, 10, 15, 20, 25 y 30, antes de avanzar a la siguiente ronda**. Cada reunión es una ronda extraordinaria de hasta 60 segundos dedicada a votar: no se planifican ni ejecutan acciones normales durante ella, y termina antes si todos los jugadores humanos ya votaron. Los bots registran también sus votos de abstención, por lo que no alargan la reunión innecesariamente.

##### Propuestas y selección
Durante la fase de planificación entre reuniones, cada jugador puede proponer resoluciones pagando **2 puntos de Influencia Política** por propuesta. La propuesta se rechaza si no puede pagar el costo. En el primer ciclo se reciben propuestas durante las rondas 1 a 4; después de cada reunión se abre el periodo de propuestas para la siguiente.

En cada reunión se seleccionan como máximo **3 propuestas**, priorizando las multas si se incorporan en el futuro y, dentro de cada prioridad, el orden de llegada. Las propuestas no seleccionadas se descartan al cerrar la selección. Por el momento, las **Multas del Banco Mundial no están implementadas ni se pueden proponer**.

##### Voto Ponderado por Influencia
A diferencia de los sistemas tradicionales de un voto por país, en PAX el peso del voto depende de la Influencia Política que cada jugador apuesta en cada resolución. Cada jugador activo debe emitir una papeleta para todas las resoluciones seleccionadas, eligiendo **A favor**, **En contra** o **Abstención**, y puede apostar una cantidad entera de Influencia que no supere su reserva disponible total. Las papeletas se registran una sola vez y se revelan al cerrar la votación.

La sesión de votación dura **hasta 60 segundos**. Los jugadores pueden registrar su papeleta una sola vez durante ese plazo; quien no vote al terminar no aporta votos ni apuestas. La votación se cierra antes si todos los jugadores humanos conectados ya votaron; los bots registran su papeleta automáticamente. Las papeletas se mantienen ocultas hasta el cierre; entonces se publican los totales por resolución. Al cerrar la sesión se consume toda la Influencia apostada, independientemente del resultado. Una resolución solo se aprueba si la suma apostada **A favor es estrictamente mayor** que la suma apostada **En contra**; la abstención no cuenta para comparar.

Los países controlados por bots votan automáticamente: si una resolución los perjudica, apuestan el 50% de su Influencia disponible **En contra**; si los beneficia, apuestan el 50% **A favor**; si es neutra, se abstienen sin apostar. Si deben apostar en varias resoluciones, la apuesta de cada una se calcula sobre la Influencia restante para no exceder su reserva.

##### Resoluciones Oficiales de la OI
- **Multas del Banco Mundial:** Resolución oficial reservada para una versión futura; no se puede proponer ni aprobar actualmente.
- **Límites de Armamento:** Fija un máximo de **10 tropas por país**. Una vez aprobada, permanece activa hasta el final de la partida.
- **Límites de Industria:** Fija un máximo de **10 fábricas por país**. Una vez aprobada, permanece activa hasta el final de la partida.
- **Zonas Desmilitarizadas (ZDM):** El proponente elige una casilla central al redactar su propuesta. La ZDM cubre esa casilla y las casillas situadas hasta dos posiciones en cada dirección (un área de 5×5, 25 casillas en el interior del mapa; se recorta en los bordes). No se pueden reclutar, estacionar ni mover tropas hacia, desde o a través de una ZDM. Al aprobarse, las tropas que ya están dentro se desplazan a la casilla propia válida más cercana. La zona permanece activa hasta la siguiente reunión de la OI.
- **Subsidios Condicionados:** Entrega **25 de Plata** al país con menor GDI en el momento de aplicar la resolución. Crea un **Pacto de No Agresión (PNA) de 5 rondas** entre el beneficiario y cada país que votó a favor. Una ruptura por ataque cancela el pacto y sanciona al atacante.

##### Sistema de Casus Belli (CB)
El diseño contempla que un ataque o bloqueo militar ejecutado sin un Casus Belli (CB) válido genere una sanción diplomática automática y otorgue a la víctima un CB de represalia legal. Las causas previstas para obtener un CB incluyen:
- Ruptura de tratados.
- Incumplimiento de resoluciones de la OI.
- Impago de deuda externa.

*Todo CB caduca estrictamente en la siguiente sesión de la OI. El historial de agresiones y los CB activos se limpian al finalizar cada reunión.*

---

#### 6. Sistema de Victoria y Marcador Global

La victoria se determina al finalizar el límite de rondas mediante el **Índice de Dominio Global (GDI)**.

$$\text{Puntuación Total} = \text{Plata} + \text{Materiales} + \text{Población Total} + \text{Influencia} + \text{Tropas} + \text{Infraestructura}$$

Todos los activos acumulados se convierten directamente a puntos con una relación matemática limpia de **1 a 1**:
- **Plata y Materiales:** 1 Punto por cada unidad acumulada en las arcas.
- **Población:** 1 Punto por cada habitante residente en las Ciudades y Capital.
- **Influencia Política:** 1 Punto por cada punto en la reserva diplomática.
- **Ejército y Flota:** 1 Punto por cada unidad militar terrestre o naval activa.
- **Infraestructura:** 1 Punto por cada nivel de fortificación o estructura industrial edificada.

El marcador muestra Plata, Materiales, Influencia Política y Población para cada nación. El GDI actual de cada país es la suma de esos cuatro valores; la tabla ordena las naciones por ese total.

---

#### 7. Especificación del Mapa e Interfaz Visual

La interfaz del mapa de PAX se rige por un lenguaje de diseño estrictamente bidimensional (**2D ortogonal, vista cenital top-down**).

##### Arquitectura de Vista y Sistema de Soberanía
- **Vista Cenital Plana (Top-Down):** El tablero se observa perpendicularmente desde arriba. La grilla está compuesta por casillas cuadradas dispuestas en una matriz uniforme.
- **Bordes de Soberanía de Jugador:** Todos los bordes de las casillas de un país usan el color de ese país (ej. Amarillo, Rojo, Verde, Morado).
- **Fronteras Compartidas:** El borde entre casillas de dos países distintos se marca en blanco.
- **Casillas Neutrales:** Todas las casillas marítimas o terrestres no reclamadas no poseen ningún borde de color exterior.

##### Composición Inicial y Cambio de Capital
- **Composición Inicial:** Cada país comienza la partida con una Capital principal. Además, su territorio asignado o adyacente puede contener otra(s) ciudad(es) o zonas de recursos desde el inicio.
- **Cambio de Capital:** Un participante puede reubicar su Capital hacia otra ciudad bajo su control ejecutando la acción estratégica *Trasladar Capital* (**Costo:** 10$ + 2 Materiales y 1 slot de acción). Al trasladarse, la nueva ciudad pasa a tener **4 de defensa base** y la anterior conserva **2 de defensa base**.

---

#### 8. Taxonomía de Casillas e Iconografía Posicional

Cada casilla del tablero está codificada mediante un color de fondo según su categoría de terreno y posee un identificador de dos o tres letras (Sigla):

| Color de Fondo | Sigla | Tipo de Casilla | Descripción y Función Táctica |
| :--- | :---: | :--- | :--- |
| **Gris Urbano (`#718096`)** | `CAP` | Capital | Sede política inexpugnable del jugador. Centro de mando principal. |
| **Gris Urbano (`#718096`)** | `CIU` | Ciudad | Núcleo de concentración demográfica y recaudación fiscal de Plata. |
| **Café Terrestre (`#8D5B4C`)** | `TR` | Tierra | Terreno llano estándar para despliegue y maniobra de tropas terrestres. |
| **Café Terrestre (`#8D5B4C`)** | `MPT` | Materia Prima Terrestre | Yacimiento mineral con descuento para construcción de Fábrica Terrestre. |
| **Café Terrestre (`#8D5B4C`)** | `FT` | Fábrica Terrestre | Instalación industrial de alta producción pasiva de Materiales (+2/turno). |
| **Azul Marítimo (`#3182CE`)** | `AG` | Agua | Superficie acuática para navegación, transporte de tropas y flotas. |
| **Azul Marítimo (`#3182CE`)** | `MPA` | Materia Prima Acuática | Yacimiento marino con descuento para plataformas o fábricas navales. |
| **Azul Marítimo (`#3182CE`)** | `FA` | Fábrica Acuática | Plataforma industrial de extracción y rendimiento marítimo (+2/turno). |

##### Anatomía Posicional de la Casilla
En el mapa, cada casilla conserva el color de terreno y su icono. La información visual se limita a:

- **Esquina superior izquierda:** Defensa (`D`) cuando la casilla tiene defensa.
- **Centro:** Icono del terreno o estructura.
- **Parte inferior izquierda:** Población (`P`) cuando corresponde.
- **Parte inferior derecha:** Tropas representadas mediante pequeños círculos.

El mapa no muestra las siglas del tipo de casilla ni el indicador circular de estado.
El inspector de la casilla seleccionada conserva el detalle completo, incluido el tipo,
el número exacto de tropas y el estado operativo (`NORMAL`, `CONFLICT` o `BLOCKED`).

El mapa inicial mide 30×30. La mayoría de sus casillas de tierra, al igual que el agua,
son neutrales; cada país ocupa un enclave terrestre pequeño que incluye una Capital y
una Ciudad. Cada casilla conserva coordenadas, país (o neutral), tipo, población, tropas,
defensa, edificio y estado (`NORMAL`, `CONFLICT` o `BLOCKED`). Al seleccionarla con un
clic, el inspector muestra estos valores; el cursor resalta suavemente la casilla
señalada y las casillas sin país no llevan borde de soberanía.
El agua se genera en cuerpos conectados de mar (sin charcos aislados) y un río continuo,
que se distingue con un tono azul más claro.
El tablero se ajusta al panel al iniciar; la rueda del ratón permite acercar y alejar,
los controles ofrecen zoom y ajuste al panel, y se puede desplazar arrastrando el mapa
o usando las barras de desplazamiento.
La pantalla principal distribuye el estado de la nación, impuestos, acciones, votaciones
y el log en un panel lateral; muestra las fases, ronda, recursos y GDI en la
barra superior; y mantiene el mapa y el inspector de casillas visibles en el área central
y el panel derecho. En desarrollo, los países sin cliente conectado los controla la IA;
un cliente que se conecta reclama un país bot libre. La fase de planificación dura 60
segundos y las rondas avanzan automáticamente. El inspector ofrece acciones de ciudad,
fábrica, reclutamiento y traslado de capital; cada acción se habilita solo si coinciden
la fase, la soberanía, el tipo de casilla y los recursos, y el servidor vuelve a validar
esas condiciones antes de aplicarla. Cada jugador dispone de tres espacios de acción que
puede reemplazar o vaciar libremente durante la etapa de planificación; las órdenes guardadas (incluidas
las decisiones de la IA) se ejecutan únicamente cuando expira el temporizador de esa fase,
al comenzar la resolución automática.
Los jugadores humanos conectados también pueden usar «Forzar» para marcarse listos;
la etapa de planificación termina inmediatamente cuando todos lo han hecho, o automáticamente al
expirar los 60 segundos. Los cambios entre las demás fases son inmediatos. El menú superior permite reanudar o terminar la partida y
volver al menú principal.
El log conserva y muestra el historial completo de la partida, incluidas
las acciones resueltas de todos los países. Para mover tropas, se selecciona primero su
casilla de origen y después cualquier destino terrestre adyacente (tierra, materia
prima terrestre, fábrica terrestre, ciudad o capital); ambos quedan
resaltados y el movimiento se guarda en un espacio. Entrar en territorio neutral lo
reclama; entrar en territorio extranjero inicia un combate al resolverse las órdenes.
El reclutamiento y el movimiento permiten elegir la cantidad de tropas,
limitada por los recursos disponibles y las órdenes ya reservadas en el otro espacio.
«Forzar» se puede alternar para retirar la confirmación antes de que todos estén listos.
Todos los bordes de cada país usan el color nacional, mientras que las fronteras
compartidas entre países son blancas.