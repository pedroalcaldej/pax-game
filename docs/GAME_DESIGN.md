# PAX — Documento de diseño del juego
**Especificación Técnica y Visual**

---

## 1. Resumen Ejecutivo y Visión General

**PAX** es un juego de estrategia geopolítica y económica en tiempo real (RTS) para **4 jugadores**, ambientado en un mundo plano en vista cenital 2D (*tilemap*). El juego pone al jugador al mando de un Estado soberano que compite por la hegemonía global en un tablero internacional interconectado, donde la dominación se construye combinando la fuerza militar con el peso institucional y las tensiones se resuelven o escalan tanto en el campo de batalla como en las mesas de negociación.

El objetivo principal de la partida es consolidar a la nación como la potencia dominante del planeta al término de un número fijado de rondas, alcanzando la puntuación más alta en el **Índice de Dominio Global (GDI)**. Dado que las Capitales son sedes políticas inexpugnables y no existe la eliminación de participantes, la victoria no se logra mediante la aniquilación o erradicación de los rivales, sino superándolos en desarrollo económico, capacidad industrial, volumen demográfico, poderío militar y liderazgo diplomático.

### Pilares Estratégicos

- **Economía:** Es el motor del Estado. Se encarga de la recaudación fiscal en **Plata**, la regulación de la tasa impositiva sobre la población y la producción de **Materiales** mediante industrias. Permite financiar proyectos, edificar defensas y sostener las fuerzas armadas.
- **Política y Diplomacia:** Representa la Proyección de Soberanía e Influencia del país en el escenario multilateral. Utiliza la **Influencia Política** para votar resoluciones vinculantes en la Organización Internacional, gestionar el sistema de Casus Belli y pactar tratados o sanciones.
- **Militar y Control Territorial:** Es la herramienta de defensa y proyección de poder sobre el mapa. Abarca el reclutamiento y movimiento de fuerzas terrestres y navales, la fortificación de posiciones clave y la ejecución de bloqueos estratégicos sobre la infraestructura enemiga.
- **Demografía y Sociedad:** Constituye la base humana y el sustento fiscal de la nación. El volumen de población en las ciudades responde dinámicamente a la presión impositiva, afectando la recaudación a largo plazo y la prosperidad del Estado.

---

## 2. Estructura de la Partida y Dinámica de Ronda

Las partidas usan por defecto el preset **Corto** (**15 rondas**, **30 segundos** de planificación y mapa de 20×20). El anfitrión puede elegir también el preset **Largo** (**30 rondas**, **60 segundos** y mapa de 30×30). Ambos presets son sólo informativos y sus valores no se pueden editar; para ajustar manualmente rondas, acciones por ronda, frecuencia de reuniones de la OI, semilla o tamaño del mapa se debe elegir **Personalizado**. Los barcos siempre están disponibles. El servidor valida y congela estos parámetros al iniciar la partida.

1. **Inicio de ronda:** desde la ronda 2, el servidor procesa en este orden Materiales, Influencia, crecimiento poblacional y recaudación de impuestos. La primera ronda solo usa las cantidades iniciales. Los intereses y vencimientos de bonos se procesan al comienzo de todas las rondas.
2. **Planificación:** es la única etapa normal en la que el jugador interactúa. Aquí se gestionan impuestos, mercado, transferencias, bonos, pagos, diplomacia y las órdenes territoriales. Los jugadores pueden confirmar que están listos; si todos lo hacen, la etapa termina antes de los 60 segundos.
3. **Resolución:** el servidor valida y ejecuta automáticamente las órdenes planificadas. Normalmente no se muestra en pantalla; si tarda más de lo esperado, la interfaz informa que está resolviendo acciones.
4. **Cierre:** se presenta el resultado de la resolución durante una ventana breve. Las tropas se animan sobre el mapa, se muestran combates y capturas, y los cambios restantes de recursos se presentan visualmente.
5. **Reunión de la OI:** al cerrar las rondas 5, 10, 15, etc., se intercala una reunión extraordinaria visible e interactiva de hasta 60 segundos antes de iniciar la siguiente ronda. Durante ella no se planifican acciones normales.

Las etapas automáticas no aceptan interacciones del jugador. La planificación concentra todas las decisiones normales y la reunión de la OI es la única excepción interactiva. Las animaciones del inicio y del cierre son presentación visual: las reglas y valores definitivos se calculan y validan en el servidor.

---

## 3. Sistema Económico, Demografía e Industria

La economía de PAX pivota sobre tres recursos principales: **Plata** (moneda de cambio), **Materiales** (insumo de construcción y reclutamiento) e **Influencia Política** (capital diplomático).

### 3.1. Mecánica Impositiva y Crecimiento Demográfico

La población de las Ciudades (`CIU`) es el motor fiscal del Estado. Las cantidades iniciales y la producción por ronda se calibran para que Plata, Materiales, Influencia y Población comiencen y evolucionen en rangos comparables; el GDI suma sus valores directamente.

1. **Rango Permitido de Impuestos:** La Tasa Impositiva ($\tau \in [0.05, 0.50]$) se fija dentro de un rango obligatorio del **5% al 50%**.
2. **Crecimiento:** cada casilla urbana crece a una tasa de $G = \frac{1}{250 \times \tau}$ por ronda, sin tope. La población añadida en cada casilla se calcula como $\operatorname{redondeo}(\text{población} \times G)$; las fracciones no se acumulan entre rondas. Con el impuesto predeterminado del 20%, la tasa es del 2%; al 5%, es del 8%.
3. **Recaudación:** la Plata obtenida por ronda es $\operatorname{redondeo}(\text{Población urbana} \times \tau \times 0.2)$. Los decimales no se acumulan entre rondas. Con 100 habitantes, al 5% se recauda 1 de Plata por ronda; al impuesto predeterminado del 20%, se recaudan 4.

> **Regla de Jugabilidad:** A menor carga impositiva, la población crece a mayor velocidad; a mayor tasa, la recaudación por habitante aumenta de inmediato.

Al comenzar, cada país recibe **0 de Plata, 0 de Materiales y 0 de Influencia**. Su Capital y Ciudad comienzan con **50 habitantes cada una**. Desde el inicio de la ronda 2, cada fábrica produce **5 de Materiales** y cada ciudad/capital genera **1 de Influencia**; después se actualiza la población y se recaudan los impuestos. Las cantidades iniciales, la producción, los precios y los costos se centralizan en `ECONOMY` dentro de `shared/Constants.js`.

El Mercado Global tiene precios fijos por Material: comprar uno cuesta **3 de Plata** y vender uno entrega **1 de Plata**. La cantidad elegida se expresa en Materiales.

### 3.2. Infraestructura Industrial

Los Materiales son indispensables para construir defensas y entrenar fuerzas armadas. Se producen mediante:

- **Fábricas (`FT` / `FA`):** Edificaciones industriales construibles tanto en tierra (`FT`) como en agua (`FA`). Desde el inicio de la ronda 2 aportan **+5 Materiales al comienzo de cada ronda** y tienen un costo de **30 de Plata y 30 de Materiales**.
- **Transporte:** Los barcos y carros cuestan lo mismo al fabricarse (**15 de Plata y 15 de Materiales**), transportan hasta 5 tropas por unidad y pueden moverse hasta dos casillas. Los barcos navegan por agua; los carros se fabrican en fábricas terrestres y recorren rutas terrestres.
- **Materia Prima (`MPT` / `MPA`):** Yacimientos naturales en tierra (`MPT`) o agua (`MPA`). No producen recursos por sí solas; construir una fábrica allí cuesta **20 de Plata y 20 de Materiales**.
- Ocupar una materia prima neutral entrega inmediatamente **20 Materiales** al país que la controla.
- **Costos de acción:** construir una ciudad cuesta **50 de Plata y 50 de Materiales**; una fábrica cuesta **30 de Plata y 30 de Materiales**, o **20 y 20** sobre un yacimiento. Reclutar una tropa cuesta **10 de Plata y 10 de Materiales**. Estos costos comparten la misma configuración que valida el servidor y muestra la interfaz.

### 3.3. Emisión de Deuda y Comercio

- **Mercado Global:** Cada jugador puede comprar materiales por **1 de Plata** o
  venderlos por **1 de Plata** cada uno. El sistema neutral no tiene límites de stock.
- **Comercio entre países:** Un jugador propone entregar Plata a cambio de Materiales,
  o viceversa; el destinatario puede aceptar o rechazar y el proponente puede cancelar.
  Entre países neutrales se pagan **2 de Plata por 1 Material**: el vendedor recibe
  **1 de Plata** y el Banco Mundial recibe **1 de Plata** por cada Material vendido.
  Los Materiales llegan íntegros al comprador. Con un TLC activo, se paga **1 de Plata
  por 1 Material**, sin aranceles. Los países en conflicto no comercian entre sí.
  El servidor comprueba la relación vigente, las cantidades y los saldos tanto al
  proponer como al aceptar; una propuesta desactualizada debe cancelarse y rehacerse.
- **Emisión de Bonos:** Un bono entrega **20 de Plata** y crea una deuda de **25 de Plata**
  con vencimiento cinco rondas después de la emisión. El saldo se cobra
  automáticamente al vencimiento si hay fondos suficientes. El impago resta
  **5 de Influencia** y añade **1 de Plata** de interés al comienzo de cada ronda
  posterior; se permiten pagos parciales y totales manuales en cualquier momento.
- **Ingreso de Influencia:** al inicio de cada ronda desde la segunda, cada ciudad o capital controlada
  otorga **1 Punto de Influencia Política**. Durante la planificación, el jugador también
  puede donar **15 de Plata al Banco Mundial** para obtener **1 Punto de Influencia**.
- **Tratado de Libre Comercio (TLC):** Acuerdo político de cinco rondas que habilita
  intercambios 1:1 sin aranceles. Una acción militar contra el firmante rompe el TLC.
  No se permiten nuevos TLC durante una guerra: combate en las últimas tres rondas o
  tropas de un país ocupando territorio del otro.

---

## 4. Logística y Combate Militar

El combate implementado incluye operaciones terrestres y navales. Las flotas se construyen
en fábricas costeras, se desplazan por casillas de agua y pueden transportar tropas.
La escolta comercial y el bloqueo costero aún no están activos.

### Combate terrestre

Las órdenes de movimiento terrestre se resuelven simultáneamente al terminar la
planificación. Primero se validan todas y se descuentan las salidas; después se
agrupan todas las llegadas por casilla. Las unidades que salieron legalmente ya no
defienden su origen, aunque la orden esté en otro espacio de acción. Una salida
inválida no escapa: sus tropas permanecen en el origen.

- Las fuerzas del mismo país que permanecen o llegan se suman antes del combate.
- Dos países enfrentados pierden una tropa por cada tropa enemiga. El vencedor
  ocupa la casilla con la diferencia: 2 contra 1 deja 1 tropa del vencedor.
- Si las fuerzas son iguales, ambas se eliminan. La casilla conserva su dueño
  anterior con cero tropas; si era neutral, sigue neutral.
- Si el defensor sale antes de la llegada enemiga y no queda otra fuerza, el
  atacante conquista sin combate y conserva todas las tropas enviadas.
- Si participan más de dos países, un vencedor debe superar la suma de todas
  las fuerzas contrarias: conserva esa diferencia. Si ninguno la supera,
  se eliminan todas las fuerzas y se conserva el propietario anterior.
- No hay retirada automática ni tropas derrotadas supervivientes como visitantes.
  Las tropas que llegan no pueden financiar otra salida en la misma resolución.
- Los movimientos terrestres se resuelven antes de las demás órdenes de construcción,
  reclutamiento y operaciones navales. Estas conservan su resolución por órdenes.
- Entrar en territorio de otro país rompe los tratados correspondientes aunque la
  guarnición haya escapado. Romper un PNA descuenta hasta 10 puntos de Influencia;
  el log conserva el país afectado, el infractor y el tratado roto.
- En el log, la orden y un eventual aviso de que no pudo realizarse son entradas
  separadas. Cada combate registra sus fuerzas y el resultado en la casilla.

### Operaciones navales

- Una fábrica propia costera permite construir barcos durante la planificación. Cada barco
  cuesta 15 de Plata y 15 de Materiales, y transporta hasta 5 tropas.
- Los barcos se mueven una casilla de agua adyacente por acción y cada barco que se mueve
  debe llevar al menos una tropa embarcada. Una flota puede embarcar tropas desde tierra
  o desde una casilla de agua que comparta con tropas, y desembarcarlas en una casilla
  terrestre adyacente. El desembarco en territorio enemigo inicia un combate terrestre.
- La acción de mover tropas cubre el movimiento terrestre, el embarque y el desembarque:
  tierra → tierra mueve, tierra → agua embarca y agua → tierra desembarca. Todas estas
  transiciones admiten las ocho casillas vecinas, incluidas las diagonales.
- Si dos flotas hostiles ocupan la misma casilla, se resuelve un combate naval durante la
  resolución de acciones. La flota atacante toma el control si sobrevive y las pérdidas
  reducen también la capacidad disponible para las tropas embarcadas.

---

## 5. Diplomacia, Organización Internacional (OI) y Casus Belli

La Organización Internacional (OI) es la mesa multilateral donde los 4 estados votan resoluciones vinculantes. Las reuniones ocurren **al terminar las rondas 5, 10, 15, 20, 25 y 30, antes de avanzar a la siguiente ronda**. Cada reunión es una ronda extraordinaria de hasta 60 segundos dedicada a votar: no se planifican ni ejecutan acciones normales durante ella, y termina antes si todos los jugadores humanos ya votaron. Los bots registran también sus votos de abstención, por lo que no alargan la reunión innecesariamente.

### Propuestas y selección
Durante la fase de planificación entre reuniones, cada jugador puede proponer resoluciones pagando **2 puntos de Influencia Política** por propuesta. La propuesta se rechaza si no puede pagar el costo. En el primer ciclo se reciben propuestas durante las rondas 1 a 4; después de cada reunión se abre el periodo de propuestas para la siguiente.

Cada tipo de resolución sólo puede proponerse una vez por reunión de la OI. Si un país ya propuso, por ejemplo, el límite de armamento, ningún otro país puede volver a proponer ese mismo tipo para esa reunión; la restricción se reinicia al abrir el siguiente periodo de propuestas.

En cada reunión se seleccionan como máximo **3 propuestas**, priorizando las multas si se incorporan en el futuro y, dentro de cada prioridad, el orden de llegada. Las propuestas no seleccionadas se descartan al cerrar la selección. Por el momento, las **Multas del Banco Mundial no están implementadas ni se pueden proponer**.

### Voto Ponderado por Influencia
A diferencia de los sistemas tradicionales de un voto por país, en PAX el peso del voto depende de la Influencia Política que cada jugador apuesta en cada resolución. Cada jugador activo debe emitir una papeleta para todas las resoluciones seleccionadas, eligiendo **A favor**, **En contra** o **Abstención**, y puede apostar una cantidad entera de Influencia que no supere su reserva disponible total. Las papeletas se registran una sola vez y se revelan al cerrar la votación.

La sesión de votación dura **hasta 60 segundos**. Los jugadores pueden registrar su papeleta una sola vez durante ese plazo; quien no vote al terminar no aporta votos ni apuestas. La votación se cierra antes si todos los jugadores humanos conectados ya votaron; los bots registran su papeleta automáticamente. Las papeletas se mantienen ocultas hasta el cierre; entonces se publican los totales por resolución. Al cerrar la sesión se consume toda la Influencia apostada, independientemente del resultado. Una resolución solo se aprueba si la suma apostada **A favor es estrictamente mayor** que la suma apostada **En contra**; la abstención no cuenta para comparar.

Los países controlados por bots votan automáticamente: si una resolución los perjudica, apuestan el 50% de su Influencia disponible **En contra**; si los beneficia, apuestan el 50% **A favor**; si es neutra, se abstienen sin apostar. Si deben apostar en varias resoluciones, la apuesta de cada una se calcula sobre la Influencia restante para no exceder su reserva.

### Resoluciones Oficiales de la OI
- **Multas del Banco Mundial:** Resolución oficial reservada para una versión futura; no se puede proponer ni aprobar actualmente.
- **Reclutamiento:** solo se pueden reclutar tropas en pueblos, ciudades o capitales propias.
  Se pagan los recursos de cada unidad y se respetan los límites de armamento y las ZDM.
- **Límites de Armamento:** Fija un máximo de **20 tropas por país**, incluidas las embarcadas y las que están en territorio ajeno. Permanece activo durante **5 turnos completos después de la votación**.
- **Límites de Industria:** Fija un máximo de **20 fábricas por país**. Una vez aprobada, permanece activa durante **5 turnos completos después de la votación**.
- **Zonas Desmilitarizadas (ZDM):** El proponente elige una casilla central al redactar su propuesta. La ZDM cubre esa casilla y las casillas situadas hasta dos posiciones en cada dirección (un área de 5×5, 25 casillas en el interior del mapa; se recorta en los bordes). No se pueden reclutar, estacionar ni mover tropas hacia, desde o a través de una ZDM. Al aprobarse, las tropas que ya están dentro se desplazan a la casilla propia válida más cercana. La zona permanece activa durante **5 turnos completos después de la votación**, independientemente de cuándo se reúna la OI.
- **Subsidios Condicionados:** Entrega **25 de Plata** al país con menor GDI en el momento de aplicar la resolución. Crea un **Pacto de No Agresión (PNA) de 5 rondas** entre el beneficiario y cada país que votó a favor. Una ruptura por ataque cancela el pacto y sanciona al atacante.

Todas las resoluciones de la OI usan la duración configurable `OI_RESOLUTION_DURATION_ROUNDS` de `shared/Constants.js` (por defecto, **5 turnos**). Una aprobación al cierre del turno 5 cubre los turnos 6 al 10. Al vencer un límite cesan sus restricciones y multas. Una nueva aprobación renueva su duración sin reiniciar la gracia si seguía activo. El subsidio sigue siendo un pago único; la duración se aplica a sus pactos asociados.

Los límites de tropas y fábricas conceden **una ronda completa de gracia** tras su aprobación. Al cierre de esa ronda y de cada ronda posterior mientras el límite esté vigente, cada país paga **2 de Plata por tropa excedente** y **5 de Plata por fábrica excedente**; las multas se suman y pueden dejar un saldo negativo como deuda. Aprobar otra vez un límite activo no renueva la gracia.

Durante la planificación se pueden **desmovilizar tropas** (incluidas las embarcadas) y **desmantelar fábricas** desde el inspector, de forma inmediata, sin consumir espacios de órdenes ni devolver recursos. Desmantelar restaura el terreno previo y conserva el propietario, las tropas y los vehículos. Los límites bloquean nuevos reclutamientos y construcciones que los superen. Los valores se configuran en `ECONOMY.OI_LIMITS` de `shared/Constants.js`.

### Sistema de Casus Belli (CB)
El diseño contempla que un ataque o bloqueo militar ejecutado sin un Casus Belli (CB) válido genere una sanción diplomática automática y otorgue a la víctima un CB de represalia legal. Las causas previstas para obtener un CB incluyen:
- Ruptura de tratados.
- Incumplimiento de resoluciones de la OI.
- Impago de deuda externa.

*Todo CB caduca estrictamente en la siguiente sesión de la OI. El historial de agresiones y los CB activos se limpian al finalizar cada reunión.*

---

## 6. Sistema de Victoria y Marcador Global

La victoria se determina al finalizar el límite de rondas. Gana el país con el **Índice de Dominio Global (GDI)** más alto.

$$\text{GDI} = \left\lfloor \text{Plata} + \text{Materiales} + \text{Influencia} + \text{Población} \right\rfloor$$

Cada unidad de **Plata**, **Materiales** e **Influencia** aporta un punto. La población aporta un punto por cada habitante de las casillas que controla el país. El total se redondea hacia abajo.

El marcador también presenta territorio, tropas, ciudades y fábricas como estadísticas, pero esos valores no se suman al GDI. La tabla ordena los países de mayor a menor puntuación.

---

## 7. Especificación del Mapa e Interfaz Visual

La interfaz del mapa de PAX se rige por un lenguaje de diseño estrictamente bidimensional (**2D ortogonal, vista cenital top-down**).

### Arquitectura de Vista y Sistema de Soberanía
- **Vista Cenital Plana (Top-Down):** El tablero se observa perpendicularmente desde arriba. La grilla está compuesta por casillas cuadradas dispuestas en una matriz uniforme.
- **Bordes de Soberanía de Jugador:** Todos los bordes de las casillas de un país usan el color de ese país (ej. Amarillo, Rojo, Verde, Morado).
- **Fronteras Compartidas:** El borde entre casillas de dos países distintos se marca en blanco.
- **Casillas Neutrales:** Todas las casillas marítimas o terrestres no reclamadas no poseen ningún borde de color exterior.

### Composición Inicial y Cambio de Capital
- **Composición Inicial:** Cada país comienza la partida con una Capital principal. Además, su territorio asignado o adyacente puede contener otra(s) ciudad(es) o zonas de recursos desde el inicio.
- **Pueblos neutrales:** El mapa puede generar pueblos (`PUE`) en tierra neutral. Cada pueblo comienza con 20 habitantes y 1 de defensa; al ocuparlo, el conquistador conserva esos valores. La generación garantiza opciones iniciales comparables: cada país dispone de un pueblo y una materia prima dentro de un radio similar a su capital, sin eliminar la variación central del mapa. Entre pueblos y ciudades/capitales se dejan al menos dos casillas libres.
- **Conquista de capital:** Al conquistar una capital, esta se convierte en ciudad, el país derrotado queda eliminado y todas sus casillas pasan al vencedor.
- **Cambio de Capital:** Un participante puede reubicar su Capital hacia otra ciudad bajo su control ejecutando la acción estratégica *Trasladar Capital* (**Costo:** 10$ + 20 Materiales y 1 slot de acción). Al trasladarse, la nueva ciudad pasa a tener **4 de defensa base** y la anterior conserva **2 de defensa base**.

---

## 8. Taxonomía de Casillas e Iconografía Posicional

Cada casilla del tablero está codificada mediante un color de fondo según su categoría de terreno y posee un identificador de dos o tres letras (Sigla):

| Color de Fondo | Sigla | Tipo de Casilla | Descripción y Función Táctica |
| :--- | :---: | :--- | :--- |
| **Gris Urbano (`#718096`)** | `CAP` | Capital | Sede política principal del jugador; puede ser conquistada mediante un ataque superior a su defensa. |
| **Gris Urbano (`#718096`)** | `CIU` | Ciudad | Núcleo de concentración demográfica y recaudación fiscal de Plata. |
| **Café Terrestre (`#8D5B4C`)** | `TR` | Tierra | Terreno llano estándar para despliegue y maniobra de tropas terrestres. |
| **Café Terrestre (`#8D5B4C`)** | `MPT` | Materia Prima Terrestre | Yacimiento mineral con descuento para construcción de Fábrica Terrestre. |
| **Café Pueblo (`#9A8065`)** | `PUE` | Pueblo | Asentamiento con 20 habitantes y 1 de defensa; una vez controlado permite reclutar tropas. |
| **Café Terrestre (`#8D5B4C`)** | `FT` | Fábrica Terrestre | Instalación industrial de alta producción pasiva de Materiales (+5/turno). |
| **Azul Marítimo (`#3182CE`)** | `AG` | Agua | Superficie acuática para navegación, transporte de tropas y flotas. |
| **Azul Marítimo (`#3182CE`)** | `MPA` | Materia Prima Acuática | Yacimiento marino con descuento para plataformas o fábricas navales. |
| **Azul Marítimo (`#3182CE`)** | `FA` | Fábrica Acuática | Plataforma industrial de extracción y rendimiento marítimo (+5/turno). |

### Anatomía Posicional de la Casilla
En el mapa, cada casilla conserva el color de terreno y su icono. Las fábricas no aparecen construidas al inicio: deben levantarse durante la partida. La información visual se limita a:

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
El mapa genera cuerpos de agua grandes; todos se representan simplemente como agua,
sin distinguir entre mar, río, laguna o lago. Su forma y posición varían según el mapa.
Las posiciones iniciales de los países también cambian en cada partida, manteniéndose
separadas y distribuidas por distintas zonas del tablero.
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
Los jugadores humanos conectados también pueden usar «Listo» para marcarse listos;
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
«Listo» se puede alternar para retirar la confirmación antes de que todos estén listos.
Todos los bordes de cada país usan el color nacional, mientras que las fronteras
compartidas entre países son blancas.
