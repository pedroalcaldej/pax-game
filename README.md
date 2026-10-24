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

## 2. Reglas y funcionalidades del juego

### Funcionalidades implementadas

- La partida tiene cuatro países. Los países sin una persona conectada se completan
  y quedan bajo control de bots; al conectarse, cada persona ocupa un país bot libre.
- Al comenzar cada fase de planificación, los bots ajustan sus impuestos al 15%,
  intentan construir una fábrica y reclutar tropas hasta un máximo de 10 (o el límite
  de armamento vigente), según el territorio y los recursos disponibles. Después
  confirman que están listos.
- Los jugadores humanos pueden pulsar «Forzar» para confirmar que terminaron de
  planificar. La confirmación se puede retirar mientras la fase no haya terminado.
  La fase avanza cuando todos los jugadores humanos están listos; si no, termina al
  cumplirse su temporizador de 60 segundos. Si una persona se desconecta durante la
  planificación, su país pasa a control de un bot.
- Las órdenes de cada país se planifican en dos espacios y se resuelven al terminar la
  fase. El servidor valida las acciones, el territorio, la fase y los recursos.
- Los controles de zoom permanecen anclados y visibles en el panel del mapa al
  desplazarse. Se puede acercar o alejar con los controles o la rueda, ajustar el mapa
  al panel y arrastrarlo para recorrerlo.
- La interfaz muestra las cuatro naciones, el estado de la ronda, la fase, los
  recursos y el GDI; se quitó la etiqueta «GDD v3.0» de la esquina superior.

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

Las partidas se configuran con un límite cerrado de **20 a 30 rondas** (definible en la sala) y un reloj de turno continuo de **60 segundos**. Cada ronda sigue una secuencia estricta de 5 fases ejecutadas de forma automatizada:

1. **Fase 1 — Crecimiento, Recaudación y Producción:** Cálculo automático de crecimiento poblacional, asignación de Plata fiscal e ingreso de Materiales industriales.
2. **Fase 2 — Planificación de Órdenes:** Emisión en paralelo de órdenes de construcción, movimientos de tropas, propuestas diplomáticas y ajuste impositivo.
3. **Fase 3 — Validación de Fondos:** Comprobación del sistema para verificar que los jugadores disponen de los fondos y materiales necesarios para ejecutar sus órdenes.
4. **Fase 4 — Ejecución Simultánea:** Resolución simultánea de desplazamientos, batallas, bloqueos y votaciones en la Organización Internacional.
5. **Fase 5 — Actualización del Tablero:** Recálculo de soberanía, actualización visual de la grilla 2D, refresco del marcador global y transición a la siguiente ronda.

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

- **Emisión de Bonos:** Permite solicitar liquidez al Banco Mundial. El interés y el monto de las cuotas futuras se calculan dinámicamente según la cantidad de rondas restantes para el fin de la partida.
- **Tratado de Libre Comercio (TLC):** Acuerdo político entre dos naciones que elimina las comisiones del Mercado Global para sus transacciones.

---

#### 4. Logística Naval, Ocupación y Bloqueo Militar

Los Barcos operan sobre casillas marítimas (`AG`, `MPA`, `FA`) y cumplen triple función: transporte de tropas, escolta comercial y bloqueo costero.

##### Mecánica Unificada de Ocupación y Bloqueo

Cuando un ejército o flota enemiga ingresa a una casilla productiva (`CIU`, `FT`, `FA`) que no contiene guarnición defensora, no la conquista inmediatamente ni cambia la soberanía de color del territorio, sino que activa un **Estado de Bloqueo en 2 etapas**:

1. **Ronda T+1 (Fase de Amenaza y Reacción):** La casilla pasa a estado **En Conflicto** (indicador amarillo en la esquina inferior derecha). El propietario original dispone de 1 turno completo para mover refuerzos o atacar al agresor.
2. **Ronda T+2 (Consolidación del Bloqueo):** Si la unidad agresora no es expulsada, la casilla entra en estado **Bloqueado** (indicador rojo). A partir de este momento, el agresor roba automáticamente el **50% de la Plata o Materiales** producidos por la casilla cada turno.

---

#### 5. Diplomacia, Organización Internacional (OI) y Casus Belli

La Organización Internacional (OI) es la mesa multilateral donde los 4 estados votan resoluciones vinculantes. Las reuniones ocurren **antes de iniciar las rondas 5, 10, 15, 20, 25 y 30**. En el ciclo de fases actual, la reunión se intercala en la fase 4 de la ronda anterior, antes de que la fase 5 avance el contador de ronda.

##### Propuestas y selección
Durante la fase de planificación entre reuniones, cada jugador puede proponer resoluciones pagando **2 puntos de Influencia Política** por propuesta. La propuesta se rechaza si no puede pagar el costo. En el primer ciclo se reciben propuestas durante las rondas 1 a 4; después de cada reunión se abre el periodo de propuestas para la siguiente.

En cada reunión se seleccionan como máximo **3 propuestas**, priorizando las multas si se incorporan en el futuro y, dentro de cada prioridad, el orden de llegada. Las propuestas no seleccionadas se descartan al cerrar la selección. Por el momento, las **Multas del Banco Mundial no están implementadas ni se pueden proponer**.

##### Voto Ponderado por Influencia
A diferencia de los sistemas tradicionales de un voto por país, en PAX el peso del voto depende de la Influencia Política que cada jugador apuesta en cada resolución. Cada jugador activo debe emitir una papeleta para todas las resoluciones seleccionadas, eligiendo **A favor**, **En contra** o **Abstención**, y puede apostar una cantidad entera de Influencia que no supere su reserva disponible total. Las papeletas se registran una sola vez y se revelan al cerrar la votación.

La votación termina cuando todos los jugadores humanos conectados han votado o al cabo de **60 segundos**. Si un jugador no vota a tiempo, no aporta votos ni apuestas. Las papeletas se mantienen ocultas hasta el cierre; entonces se publican los totales por resolución. Al cerrar la sesión se consume toda la Influencia apostada, independientemente del resultado. Una resolución solo se aprueba si la suma apostada **A favor es estrictamente mayor** que la suma apostada **En contra**; la abstención no cuenta para comparar.

Los países controlados por bots votan automáticamente: si una resolución los perjudica, apuestan el 50% de su Influencia disponible **En contra**; si los beneficia, apuestan el 50% **A favor**; si es neutra, se abstienen sin apostar. Si deben apostar en varias resoluciones, la apuesta de cada una se calcula sobre la Influencia restante para no exceder su reserva.

##### Resoluciones Oficiales de la OI
- **Multas del Banco Mundial:** Resolución oficial reservada para una versión futura; no se puede proponer ni aprobar actualmente.
- **Límites de Armamento:** Fija un máximo de **10 tropas por país**. Una vez aprobada, permanece activa hasta el final de la partida.
- **Límites de Industria:** Fija un máximo de **10 fábricas por país**. Una vez aprobada, permanece activa hasta el final de la partida.
- **Zonas Desmilitarizadas (ZDM):** El proponente elige una casilla central al redactar su propuesta. La ZDM cubre esa casilla y las casillas situadas hasta dos posiciones en cada dirección (un área de 5×5, 25 casillas en el interior del mapa; se recorta en los bordes). No se pueden reclutar, estacionar ni mover tropas hacia, desde o a través de una ZDM. Al aprobarse, las tropas que ya están dentro se desplazan a la casilla propia válida más cercana. La zona permanece activa hasta la siguiente reunión de la OI.
- **Subsidios Condicionados:** Entrega **25 de Plata** al país con menor GDI en el momento de aplicar la resolución. Crea un **Pacto de No Agresión (PNA) de 5 rondas** entre el beneficiario y cada país que votó a favor. Los países unidos por el pacto no pueden atacarse durante su vigencia.

Actualmente el juego aún no implementa acciones de ataque, por lo que los PNA quedan registrados y disponibles para aplicar la restricción cuando se incorpore el combate.

##### Sistema de Casus Belli (CB)
Cualquier ataque o bloqueo militar ejecutado sin un Casus Belli (CB) válido genera una sanción diplomática automática y otorga a la víctima un CB de represalia legal. Las causas válidas para obtener un CB incluyen:
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

El marcador muestra el puntaje actual de cada nación y su desglose. En la implementación actual, el puntaje parte de 100 y acumula puntos por población e industria al procesar la economía de cada ronda; los demás componentes de la fórmula total se incorporarán posteriormente.

---

#### 7. Especificación del Mapa e Interfaz Visual

La interfaz del mapa de PAX se rige por un lenguaje de diseño estrictamente bidimensional (**2D ortogonal, vista cenital top-down**).

##### Arquitectura de Vista y Sistema de Soberanía
- **Vista Cenital Plana (Top-Down):** El tablero se observa perpendicularmente desde arriba. La grilla está compuesta por casillas cuadradas dispuestas en una matriz uniforme.
- **Bordes de Soberanía de Jugador:** El territorio perteneciente a cada jugador se delimita mediante un borde exterior continuo de color sólido único (ej. Amarillo, Rojo, Verde, Morado).
- **Límites Internos:** Las divisiones provinciales o internas entre casillas de un mismo país se marcan con líneas finas de color blanco.
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
Cada casilla individual funciona como una tarjeta modular limpia con un diseño estandarizado para sus datos:

- **Esquina Superior Izquierda — Escudo (`[DEF]`):** Nivel de fortificación y resistencia de la casilla.
- **Esquina Superior Derecha — Siglas (`[TIPO]`):** Siglas alfanuméricas del tipo de terreno (`CAP`, `CIU`, `TR`, `MPT`, `FT`, `AG`, `MPA`, `FA`).
- **Centro — Ilustración Central:** Dibujo lineal simplificado representativo de la estructura o terreno.
- **Inferior Izquierda — Población / Materiales:** Habitantes residentes (icono silueta de personas) y tasa de producción de Materiales (icono caja/flecha).
- **Inferior Derecha — Fuerza Militar / Plata:** Potencia de combate (icono espadas) e ingresos por impuestos de Plata (icono moneda/bolsa).
- **Esquina Inferior Derecha — Indicador de Estado:** Círculo de color que marca el estado operativo:
  - 🟢 **Verde:** Normal.
  - 🟡 **Amarillo:** En Conflicto.
  - 🔴 **Rojo:** Bloqueada.

El mapa inicial mide 30×30. La mayoría de sus casillas de tierra, al igual que el agua,
son neutrales; cada país ocupa un enclave terrestre pequeño que incluye una Capital y
una Ciudad. Cada casilla conserva coordenadas, país (o neutral), tipo, población, tropas,
defensa, edificio y estado (`NORMAL`, `CONFLICT` o `BLOCKED`). Al seleccionarla con un
clic, el inspector muestra estos valores; las casillas sin país no llevan borde de soberanía.
El agua se genera en cuerpos conectados de mar (sin charcos aislados) y un río continuo,
que se distingue con un tono azul más claro.
El tablero se ajusta al panel al iniciar; la rueda del ratón permite acercar y alejar,
los controles ofrecen zoom y ajuste al panel, y se puede desplazar arrastrando el mapa
o usando las barras de desplazamiento.
La pantalla principal distribuye el estado de la nación, impuestos, acciones, votaciones
y registro de eventos en un panel lateral; muestra las fases, ronda, recursos y GDI en la
barra superior; y mantiene el mapa y el inspector de casillas visibles en el área central
y el panel derecho. En desarrollo, los países sin cliente conectado los controla la IA;
un cliente que se conecta reclama un país bot libre. La fase de planificación dura 60
segundos y las rondas avanzan automáticamente. El inspector ofrece acciones de ciudad,
fábrica, reclutamiento y traslado de capital; cada acción se habilita solo si coinciden
la fase, la soberanía, el tipo de casilla y los recursos, y el servidor vuelve a validar
esas condiciones antes de aplicarla. Cada jugador dispone de dos espacios de acción que
puede reemplazar o vaciar libremente durante la fase 2; las órdenes guardadas (incluidas
las decisiones de la IA) se ejecutan únicamente cuando expira el temporizador de esa fase,
al entrar en la fase 3.
Los jugadores humanos conectados también pueden usar «Forzar» para marcarse listos;
la fase 2 termina inmediatamente cuando todos lo han hecho, o automáticamente al
expirar los 60 segundos. El menú superior permite reanudar o terminar la partida y
volver al menú principal.
Para mover tropas, se selecciona primero su casilla de origen y después el destino terrestre
adyacente; ambos quedan resaltados y el movimiento se guarda en un espacio. Al entrar en
tierra neutral, las tropas ocupan la casilla y esta pasa a tener como propietario al país
que la reclamó. El reclutamiento y el movimiento permiten elegir la cantidad de tropas,
limitada por los recursos disponibles y las órdenes ya reservadas en el otro espacio.
«Forzar» se puede alternar para retirar la confirmación antes de que todos estén listos.
El límite exterior continuo de las casillas
propias usa el color de su nación y las divisiones internas usan líneas claras.