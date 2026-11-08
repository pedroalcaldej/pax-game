# PAX — Reglas y diseño del juego

Este documento describe las reglas implementadas. Los valores corresponden a la configuración del repositorio; los ajustes de una partida pueden cambiar su duración, mapa y cantidad de órdenes. Aquí, **turno** y **ronda** significan el mismo ciclo de planificación y resolución para todos los países.

Para instalar y ejecutar el proyecto, consulta el [README](../README.md). El funcionamiento interno y entrenamiento de la IA están en [BOTS.md](BOTS.md).

## Contenido

- [1. Objetivo y participantes](#1-objetivo-y-participantes)
- [2. Configuración e inicio](#2-configuración-e-inicio)
- [3. Ciclo de una ronda](#3-ciclo-de-una-ronda)
- [4. Mapa, territorio y capitales](#4-mapa-territorio-y-capitales)
- [5. Recursos, población e impuestos](#5-recursos-población-e-impuestos)
- [6. Construcción y acciones territoriales](#6-construcción-y-acciones-territoriales)
- [7. Movimiento y combate](#7-movimiento-y-combate)
- [8. Finanzas y comercio](#8-finanzas-y-comercio)
- [9. Tratados y conflicto](#9-tratados-y-conflicto)
- [10. Organización Internacional](#10-organización-internacional)
- [11. Límites, gracia y multas](#11-límites-gracia-y-multas)
- [12. Victoria y puntuación](#12-victoria-y-puntuación)
- [13. Interfaz, avisos y sesiones](#13-interfaz-avisos-y-sesiones)
- [14. Configuración y alcance implementado](#14-configuración-y-alcance-implementado)

## 1. Objetivo y participantes

PAX combina economía, expansión territorial, combate y diplomacia para **cuatro países**. Cada país lo controla una persona o un bot. Las decisiones se planifican con un reloj compartido y se resuelven por rondas; las tropas no se desplazan continuamente mientras se planifica.

El objetivo es terminar el número de rondas configurado con el mayor **Índice de Dominio Global (GDI)**. Las capitales **sí se pueden conquistar**: perder la capital elimina al país y transfiere su territorio al vencedor. La partida no depende únicamente de la conquista; también cuentan los recursos y la población acumulados.

## 2. Configuración e inicio

### Presets

| Ajuste | Corto, predeterminado | Largo |
| --- | --- | --- |
| Rondas | 15 | 30 |
| Tiempo de planificación | 30 segundos | 60 segundos |
| Órdenes por país y ronda | 3 | 3 |
| Tamaño del mapa | 20×20 | 30×30 |

El anfitrión puede elegir **Personalizado** para editar rondas (5–100), planificación (15–300 segundos), órdenes (1–6), frecuencia de la OI (0–20 rondas), tamaño del mapa (12–50 casillas por lado) y semilla. Una frecuencia OI de 0 desactiva sus reuniones. Los campos de los presets Corto y Largo se muestran como referencia; el servidor valida la configuración al iniciar.

La configuración compartida también contempla recursos iniciales y duración de la votación. Estos parámetros no aparecen todos como campos del lobby; sus valores predeterminados y rangos se definen en `shared/Constants.js`.

### Preparación y condiciones iniciales

En una sala, los humanos eligen nombre y color y pulsan **Listo**. Cuando todos confirman, comienza la partida y los países restantes se completan con bots. Antes de ese inicio se puede retirar la confirmación.

Por defecto, cada país comienza con:

| Elemento | Cantidad |
| --- | --- |
| Plata, Materiales e Influencia | 0 de cada recurso |
| Capital | 50 habitantes, 4 tropas y 4 de defensa |
| Ciudad inicial | 50 habitantes, 2 tropas y 2 de defensa |
| Impuestos | 20% |
| Fábricas | Ninguna |

Los enclaves iniciales están separados. El mapa distribuye pueblos y materias primas cercanos a cada país para ofrecer oportunidades de expansión comparables, manteniendo variación entre semillas.

## 3. Ciclo de una ronda

| Etapa | Qué sucede |
| --- | --- |
| Inicio | Expiran las resoluciones cuyo plazo terminó. Se procesan vencimientos e intereses de bonos. Desde la ronda 2 se producen Materiales, crece la población y se recaudan impuestos. |
| Planificación | Se eligen órdenes, impuestos, operaciones financieras y tratados. Las órdenes territoriales quedan pendientes; finanzas, diplomacia, desmovilización y desmantelamiento son inmediatos. |
| Resolución | El servidor valida las órdenes con el estado efectivo. Primero resuelve las llegadas terrestres simultáneas; luego procesa las demás acciones. |
| Cierre de acciones | La interfaz presenta movimientos, combates y resultados. |
| Reunión de la OI, si corresponde | Se votan resoluciones, sin acciones normales. Ocurre antes del resumen de la ronda. |
| Resumen y avance | Se cobran multas OI vigentes, se otorga Influencia por ciudades/capitales, se registran cambios de impuestos y vencen los tratados que terminan en esa ronda. Se inicia la siguiente o se cierra la partida. |

La planificación termina al agotarse el tiempo o cuando todos los países activos están listos. Los bots confirman después de decidir; los humanos pueden alternar **Listo** mientras no haya comenzado la resolución.

Las reuniones de la OI ocurren cada 5 rondas por defecto, siempre que quede una ronda posterior por jugar. Por ejemplo, una partida de 15 rondas tiene reuniones después de las rondas 5 y 10; no necesita una reunión después de su última ronda. La frecuencia es independiente de la duración de las resoluciones.

Las fases automáticas no aceptan nuevas decisiones. Una orden válida al planificarse puede fallar al ejecutarse si cambian el territorio, las tropas, los recursos o las restricciones. El registro indica el resultado; guardar una orden no garantiza que se ejecute.

## 4. Mapa, territorio y capitales

El tablero es una cuadrícula 2D vista desde arriba. Su tamaño y distribución dependen de la configuración y la semilla. La mayor parte del territorio empieza neutral.

### Tipos de casilla

| Sigla | Tipo | Función |
| --- | --- | --- |
| `CAP` | Capital | Centro político: permite reclutar y tiene 4 de defensa base. Su conquista elimina al propietario derrotado. |
| `CIU` | Ciudad | Población, impuestos, reclutamiento e Influencia; 2 de defensa base. |
| `PUE` | Pueblo | Asentamiento neutral con 20 habitantes y 1 de defensa. Al ocuparlo conserva esos valores y permite reclutar. Produce impuestos y crecimiento, pero no la Influencia de una ciudad/capital. |
| `TR` | Tierra | Movimiento terrestre; admite construcción de ciudad o fábrica si está vacía. |
| `MPT` | Materia prima terrestre | Descuento de construcción industrial; captura neutral con recompensa de Materiales. |
| `FT` | Fábrica terrestre | Producción de Materiales, fabricación de carros y de barcos si tiene acceso al agua. |
| `AG` | Agua | Navegación y transporte naval. |
| `MPA` | Materia prima acuática | Descuento de fábrica acuática; captura neutral con recompensa de Materiales. |
| `FA` | Fábrica acuática | Producción de Materiales y construcción de barcos. |

Los colores distinguen tierra, agua y asentamientos. Los bordes usan el color del país; las fronteras compartidas se marcan en blanco. Los territorios neutrales no llevan borde nacional.

### Capturas y cambio de capital

Ocupar una casilla neutral la reclama. Entrar en territorio extranjero puede conquistarlo sin combate si no queda fuerza defensora, o iniciar un combate si hay oposición. Ocupar una materia prima neutral concede **20 Materiales** una vez en esa captura; el yacimiento no produce recursos por sí mismo.

Al conquistar una capital:

- La casilla se convierte en ciudad.
- El país derrotado queda eliminado y deja de emitir órdenes.
- Todo su territorio pasa al vencedor; las tropas del derrotado se retiran y los vehículos se transfieren según las reglas de captura.

**Trasladar capital** permite elegir una ciudad propia como nueva capital. Cuesta **10 de Plata y 20 Materiales** y consume una orden. La nueva capital recibe 4 de defensa; la anterior se convierte en ciudad con 2 de defensa. No cambia la población por sí solo.

## 5. Recursos, población e impuestos

### Recursos e ingresos

| Recurso | Usos | Fuentes principales |
| --- | --- | --- |
| Plata | Construcción, reclutamiento, mercado, transferencias, deuda y multas | Impuestos, ventas, comercio, bonos y subsidios |
| Materiales | Construcción, reclutamiento y vehículos | Fábricas, materias primas neutrales y compras |
| Influencia Política | Propuestas y votos OI; penalizaciones diplomáticas | Ciudades/capitales y donaciones al Banco Mundial |

Cada fábrica produce **5 Materiales al inicio de la ronda**, desde la segunda. Al **cierre de cada ronda, incluida la primera**, cada ciudad o capital controlada concede **1 de Influencia**. Los pueblos no conceden ese ingreso de Influencia.

### Impuestos y demografía

La tasa impositiva se puede ajustar durante la planificación entre **5% y 50%**; el valor inicial es **20%**. Sus efectos demográficos y fiscales se procesan en el siguiente inicio de ronda.

Para cada capital, ciudad o pueblo:

```text
Tasa de crecimiento = 1 / (250 × tasa de impuestos)
Habitantes añadidos = redondear(población × tasa de crecimiento)
Nueva población = población + habitantes añadidos
```

Después del crecimiento se suma la población urbana controlada y se recauda:

```text
Plata recaudada = redondear(población urbana actualizada × tasa de impuestos × 0,2)
```

No se acumulan fracciones entre rondas. Con 100 habitantes y una tasa del 20%, el crecimiento añade 2 habitantes; sobre los 102 actualizados se recaudan 4 de Plata. Con un 5%, la tasa de crecimiento es del 8%; con un 20%, es del 2%.

Bajar impuestos favorece el crecimiento; subirlos eleva la recaudación por habitante. Los parámetros de estas fórmulas están en `ECONOMY.POPULATION`.

## 6. Construcción y acciones territoriales

### Costos por unidad

| Acción | Plata | Materiales | Dónde |
| --- | --- | --- | --- |
| Construir ciudad | 50 | 50 | Tierra propia vacía (`TR`) |
| Construir fábrica | 30 | 30 | Tierra o agua propias sin edificio |
| Construir fábrica sobre materia prima | 20 | 20 | `MPT` o `MPA` propias sin edificio |
| Reclutar tropa | 10 | 10 | Capital, ciudad o pueblo propios |
| Construir barco | 15 | 15 | Fábrica acuática propia o fábrica terrestre con puerto válido adyacente |
| Fabricar carro | 15 | 15 | Fábrica terrestre propia |
| Trasladar capital | 10 | 20 | Ciudad propia |

Una ciudad nueva comienza con **50 habitantes y 2 de defensa**. Las fábricas solo empiezan a producir en el siguiente procesamiento económico.

Cada construcción, reclutamiento o movimiento ocupa un espacio de órdenes. Se pueden elegir varias tropas o vehículos en una orden cuando la acción admite cantidad; se paga el costo de cada unidad. Los recursos y unidades comprometidos en otras órdenes reducen lo disponible para planificar nuevas acciones.

Los límites OI, las ZDM, la soberanía, el terreno y los recursos condicionan la disponibilidad. El servidor los valida al planificar y al resolver. Las tropas que llegarán más tarde no se pueden usar para financiar una salida anterior de la misma resolución.

### Retirar tropas o fábricas

Durante la planificación, el inspector permite:

- **Desmovilizar tropas:** elegir una casilla y una cantidad de tropas propias, incluidas las embarcadas o las propias estacionadas en territorio ajeno. Se retiran sin afectar las tropas de otro país.
- **Desmantelar fábrica:** retirar una fábrica propia. Las fábricas construidas guardan el terreno previo para restaurarlo; las iniciales o antiguas sin ese dato vuelven a tierra o agua según corresponda. Se conservan propietario, tropas y vehículos.

Ambas acciones son **inmediatas, no consumen órdenes y no devuelven recursos**. Se pueden usar aunque no haya un límite OI vigente. Las órdenes ya guardadas no se borran automáticamente: revisa las que dependían de las unidades o la fábrica retiradas.

## 7. Movimiento y combate

### Movimiento terrestre y transporte

Las tropas a pie avanzan a una casilla adyacente, incluidas las diagonales. Los carros transportan **hasta 5 tropas cada uno** y permiten recorrer hasta **2 casillas** por una ruta terrestre válida. Los barcos también transportan **hasta 5 tropas cada uno** y navegan hasta **2 casillas** por una ruta de agua válida.

Los transportes cuestan **15 de Plata y 15 Materiales por unidad**. Los carros se fabrican en fábricas terrestres; los barcos en fábricas con acceso al agua. Los movimientos de carros y barcos pueden reclamar las casillas neutrales intermedias de su ruta.

### Resolución terrestre simultánea

Primero se validan y descuentan todas las salidas legales. Después se agrupan las llegadas por destino, sumando refuerzos de un mismo país. Este grupo incluye movimientos a pie, en carros y desembarcos. El orden de los países o de sus espacios no permite atacar a tropas que ya salieron legalmente.

| Situación | Resultado |
| --- | --- |
| 2 tropas contra 1, sin defensa fija | El vencedor controla la casilla con 1 tropa. |
| Fuerzas iguales | Todas las tropas participantes se eliminan; se conserva el propietario anterior. Si era neutral, sigue neutral. |
| El defensor salió y no queda fuerza ni defensa fija que lo sostenga | La llegada puede conquistar sin bajas. |
| Más de dos países | Gana quien supera la suma de todas las fuerzas contrarias; conserva la diferencia. Si ninguno la supera, se eliminan todas las tropas participantes. |
| Dos ejércitos cruzan sus rutas y abandonan sus orígenes | No hay combate en el borde: se resuelven sus destinos. |

La **defensa fija** se suma a la fuerza del propietario ante una llegada hostil y no se consume. Una capital con 4 de defensa y sin tropas detiene un ataque de 4; un ataque de 5 la supera y deja 1 tropa atacante. Si vence el propietario, la defensa no se convierte en tropas supervivientes.

Las tropas derrotadas no se retiran automáticamente ni quedan como visitantes supervivientes. Los carros y barcos de una casilla pueden pasar al vencedor como botín; los carros transportados por una fuerza atacante derrotada tampoco se destruyen automáticamente. Si el combate terrestre termina empatado, los carros que llegaron regresan a sus orígenes.

### Embarque, desembarque y combate naval

La acción de mover tropas distingue las transiciones:

- Tierra → tierra: movimiento terrestre.
- Tierra → agua con flota propia: embarque, respetando capacidad disponible.
- Agua → tierra adyacente: desembarco; si hay enemigos, participa en la resolución terrestre.

Se admiten destinos adyacentes diagonales para embarcar y desembarcar. Cada barco que se mueve debe llevar al menos una tropa embarcada; la carga trasladada queda limitada por la capacidad de los barcos enviados.

El combate naval se resuelve en las operaciones navales, después de los movimientos terrestres. Si los barcos enviados superan los barcos enemigos del destino, el atacante ocupa la casilla y captura los barcos y su carga; si no los supera, entrega los barcos enviados y su carga al vencedor. Los barcos funcionan como botín y no siguen la regla de desgaste de tropas terrestres.

## 8. Finanzas y comercio

Las operaciones financieras se ejecutan inmediatamente durante la planificación y no consumen espacios de órdenes. No se permiten durante la votación de la OI ni las fases automáticas.

### Mercado Global

| Operación | Precio por Material |
| --- | --- |
| Comprar | 3 de Plata |
| Vender | 1 de Plata |

La cantidad elegida se expresa en Materiales. El mercado tiene precios fijos y no limita las operaciones por stock del Banco Mundial. Una compra requiere la Plata necesaria y una venta requiere los Materiales que se entregan.

### Comercio y transferencias entre países

En un **intercambio**, un país propone entregar Plata por Materiales, o viceversa. El destinatario acepta o rechaza; el proponente puede cancelar. El servidor comprueba saldos y relación diplomática al proponer y al aceptar.

| Relación | Pago del comprador por Material | Recibe el vendedor | Recibe el Banco Mundial |
| --- | --- | --- | --- |
| Sin TLC y sin conflicto | 2 de Plata | 1 de Plata | 1 de Plata |
| TLC vigente y sin conflicto | 1 de Plata | 1 de Plata | 0 |
| Países en conflicto | Intercambio bloqueado | — | — |

Los Materiales llegan íntegros al comprador. Un cambio de relación puede invalidar una propuesta pendiente; debe cancelarse y rehacerse con las condiciones vigentes. Los bots aceptan automáticamente los intercambios legales de precio fijo si pueden completarlos.

Una **transferencia** entrega Plata o Materiales sin contraprestación. Sin TLC, el Banco Mundial retiene el **20%**, redondeado hacia arriba, del recurso transferido; el destinatario recibe el resto. Con TLC no hay arancel. Las transferencias entre países en conflicto están bloqueadas.

### Donaciones y bonos

Donar **15 de Plata** al Banco Mundial otorga **1 de Influencia**.

Un bono entrega **20 de Plata** y crea una deuda de **25 de Plata**, con vencimiento cinco rondas después de emitirlo. Solo puede haber **un bono pendiente por país**, y el Banco Mundial necesita 20 de Plata disponibles para comprarlo.

Al comienzo de la ronda de vencimiento, el servidor cobra el saldo completo si hay Plata suficiente. Si no alcanza, declara impago y descuenta hasta **5 de Influencia**, sin hacerla negativa. Cada ronda posterior añade **1 de Plata** de interés. Durante la planificación se pueden efectuar pagos manuales parciales o totales; un bono impagado no se liquida automáticamente solo porque después haya fondos.

La deuda de bonos y un saldo negativo por multas OI son conceptos distintos: los bonos tienen saldo y vencimiento propios; las multas se descuentan directamente de la Plata disponible.

## 9. Tratados y conflicto

Los países pueden proponer tratados durante la planificación. El destinatario acepta o rechaza; el proponente puede cancelar una oferta pendiente. No se pueden duplicar tratados vigentes del mismo tipo entre los mismos países.

| Tratado | Efecto |
| --- | --- |
| Pacto de No Agresión (PNA) | Su ruptura por invasión penaliza al invasor con hasta 10 de Influencia, sin saldo negativo de Influencia. |
| Tratado de Libre Comercio (TLC) | Habilita intercambios 1:1 y transferencias sin arancel, mientras no haya conflicto. |

Los tratados diplomáticos ordinarios duran **cinco rondas contando la de aceptación**: si se firman en la ronda 3, están vigentes de la 3 a la 7 y vencen al cierre de la 7. Los pactos creados por un subsidio OI usan el plazo de esa resolución, explicado en la sección siguiente.

### Ruptura por acción militar

- Invadir una casilla del otro firmante rompe los tratados correspondientes, aunque el defensor haya retirado sus tropas.
- Si hay combate en territorio de uno de los países, la responsabilidad del PNA recae en el invasor. Los refuerzos que defienden territorio propio no pagan la penalización.
- Si los dos países combaten en una casilla neutral, terminan el PNA y el TLC, pero **ninguno pierde Influencia** por ese enfrentamiento.
- Si ambos invaden territorio del otro en la misma resolución terrestre, cada invasor puede recibir su penalización. Repetir ataques de un país contra el mismo firmante no multiplica la penalización dentro de esa resolución.
- La ruptura del TLC restablece los aranceles; no tiene una penalización propia de Influencia.

Los países afectados reciben avisos y el registro conserva el tratado, los participantes y la responsabilidad cuando corresponde. También se notifican los vencimientos.

Se considera conflicto reciente el registrado en la ronda actual o en las dos anteriores, o la presencia de tropas de un país en territorio del otro. El conflicto bloquea comercio y transferencias, y no permite firmar un nuevo TLC mientras siga vigente esa condición.

## 10. Organización Internacional

### Cuándo se reúne y qué se propone

Por defecto, la OI se reúne cada **5 rondas**, con votación de hasta **60 segundos**. Ambos parámetros pertenecen a la configuración de partida. No se reúne después de la última ronda.

Durante la planificación previa a la reunión se proponen resoluciones pagando **2 de Influencia** cada una. Se puede proponer también en la ronda que terminará con una reunión. Cada tipo de resolución solo puede estar propuesto una vez para esa reunión, sin importar quién lo proponga.

Se seleccionan hasta **3 propuestas por orden de llegada**. Las restantes se descartan y se abre un nuevo periodo de propuestas. Si no hay mociones, la sesión termina sin votación.

### Voto por Influencia

Cada papeleta contiene una decisión por propuesta: **A favor**, **En contra** o **Abstención**, junto con una apuesta entera no negativa de Influencia. La suma no puede superar la reserva del país. La interfaz usa al menos 1 para un voto activo; el servidor admite valores no negativos. La papeleta solo se registra una vez.

Las papeletas permanecen ocultas hasta el cierre. Se consume **toda la Influencia apostada**, independientemente del resultado. Una resolución se aprueba únicamente si la apuesta total a favor supera estrictamente la apuesta en contra; un empate la rechaza y la abstención no cuenta en esa comparación.

La votación termina al agotarse el tiempo o cuando todos los humanos conectados han votado. Quien no vote no aporta apuestas. Los bots registran su papeleta automáticamente: apuestan la mitad de su Influencia restante contra una medida que les perjudica, a favor si les beneficia y se abstienen si es neutra.

### Resoluciones implementadas

| Resolución | Efecto |
| --- | --- |
| Límite de Armamento | Máximo de **20 tropas propias en total**, incluyendo las embarcadas y las que estén en territorio ajeno. |
| Límite de Industria | Máximo de **20 fábricas controladas** por país. |
| Zona Desmilitarizada (ZDM) | Área de hasta **5×5 casillas**, centrada en la casilla propuesta y recortada en los bordes. Restringe reclutamiento y movimientos cuyo origen o destino esté en ella. |
| Subsidio Condicionado | Pago único de **25 de Plata** al país seleccionado por menor GDI al abrir la votación. Crea PNA entre ese beneficiario y los países que votaron a favor. |

Al aprobar una ZDM, las tropas terrestres dentro del área se desplazan a una casilla terrestre propia válida fuera de las zonas activas, eligiendo la más cercana. Si no hay una casilla válida, esas tropas se retiran del tablero.

### Duración y renovación

Todas las resoluciones usan `OI_RESOLUTION_DURATION_ROUNDS` de `shared/Constants.js`, cuyo valor predeterminado es **5 turnos completos después de la aprobación**. Su plazo no depende de la siguiente reunión.

**Ejemplo:** una resolución aprobada al cierre del turno 5 está vigente durante los turnos 6, 7, 8, 9 y 10. El límite puede cobrar su última multa al cierre del 10; antes de empezar el 11 se retira y dejan de aplicarse sus restricciones y multas. La deuda de multas ya cobradas no se perdona por el vencimiento.

Aprobar otra vez un límite aún vigente renueva su fecha de vencimiento, **sin reiniciar la gracia**. Si ya había vencido, una nueva aprobación inicia otra vigencia con su propio plazo de regularización.

El subsidio sigue siendo **un pago único**, no un ingreso por ronda. La duración corresponde a sus pactos asociados; al vencerlos no se devuelve el dinero recibido.

## 11. Límites, gracia y multas

Los máximos de tropas y fábricas **solo se activan si se aprueba su resolución**. Cada límite es independiente; sin esa resolución vigente no hay máximo ni multa de ese tipo.

### Regularización

Cada aprobación nueva concede **1 ronda completa de gracia**. Durante esa ronda el país puede desmovilizar tropas o desmantelar fábricas desde el inspector. Se bloquean reclutamientos y nuevas construcciones que superen los máximos; la gracia no habilita a seguir aumentándolos.

Al cierre de la ronda de gracia se revisan los totales efectivos, después de las capturas y pérdidas. No se eliminan tropas ni fábricas automáticamente por superar el máximo: se cobran multas. Las fábricas excedentes continúan produciendo mientras permanezcan construidas.

### Cobro

| Exceso | Multa por unidad y por ronda |
| --- | --- |
| Cada tropa por encima de 20 | 2 de Plata |
| Cada fábrica por encima de 20 | 5 de Plata |

Las multas se suman y se repiten en cada cierre mientras persista el exceso y siga vigente la resolución. Si no alcanza la Plata, el saldo queda **negativo como deuda**; ingresos posteriores lo compensan.

Ejemplo: si ambos límites se aprobaron al cierre del turno 5, hay que regularizar durante el 6. Si al cierre del 6 quedan **23 tropas y 21 fábricas**, se cobran `(3 × 2) + (1 × 5) = 11 de Plata`. Con un saldo previo de 4, el país termina con **−7 de Plata**. Si vuelve al máximo antes del cierre siguiente, ese cierre no genera una nueva multa.

El panel OI muestra los totales, máximos, plazo y multa potencial. Las aprobaciones, multas y vencimientos generan avisos y entradas en el registro.

Estos valores se cambian en `ECONOMY.OI_LIMITS`: `TROOPS`, `FACTORIES`, `GRACE_ROUNDS`, `TROOP_FINE_SILVER` y `FACTORY_FINE_SILVER`.

## 12. Victoria y puntuación

La partida termina al cerrar la última ronda configurada. Se calcula:

```text
GDI = redondear hacia abajo(Plata + Materiales + Influencia + población controlada)
```

Cada unidad de recurso y cada habitante aportan un punto. El saldo negativo de Plata por multas reduce la puntuación. Los saldos pendientes de bonos no se restan adicionalmente en esta fórmula; sus pagos sí reducen la Plata cuando se ejecutan.

El marcador ordena por GDI y también informa territorio, tropas, ciudades y fábricas. Esas estadísticas no suman puntos de forma directa. La pérdida de capital elimina al país, pero el reloj global y la condición de cierre siguen basados en el número de rondas configurado.

## 13. Interfaz, avisos y sesiones

### Controles y paneles

- **Mapa:** selección de casillas, zoom con rueda y controles, ajuste al panel y desplazamiento por arrastre o barras. Se puede consultar el historial de mapas de rondas anteriores; esa vista es de consulta.
- **Inspector:** dueño, terreno, población, tropas, defensa, barcos, carros, carga y acciones disponibles. Las cantidades se ajustan con los recursos o unidades que siguen libres.
- **Órdenes:** espacios reemplazables y vaciables durante la planificación. Para mover unidades se elige primero origen y cantidad y después el destino permitido.
- **Economía y diplomacia:** impuestos, mercado, transferencias, intercambios, bonos, tratados y propuestas OI.
- **OI y marcador:** votaciones, resultados, límites vigentes y puntuaciones por país.
- **Registro:** órdenes ejecutadas o fallidas, combates, capturas, tratados, economía y multas. Los avisos emergentes destacan propuestas recibidas, rupturas y vencimientos relevantes.
- **Audio:** música y efectos con volúmenes separados. Incluye sonido al comenzar una partida; las preferencias se conservan en el navegador.

Las casillas muestran icono de terreno/estructura, defensa, población y tropas según corresponda. El inspector conserva el detalle numérico y los estados internos `NORMAL`, `CONFLICT` y `BLOCKED`.

### Pausa y reconexión

La partida individual se pausa al desconectarse o perder visibilidad/foco y permite recuperar su país, órdenes y reloj. Una pausa manual requiere reanudación manual. El servidor guarda las sesiones individuales al iniciar, pausar y finalizar; volver al menú principal abandona y elimina el guardado.

Una desconexión multijugador reserva el país, pero no pausa la partida de los demás. Redis almacena los datos del lobby; el tablero activo reside en Node. La instalación y los límites de persistencia se explican en el [README](../README.md#salas-guardado-y-reconexión).

## 14. Configuración y alcance implementado

### Fuentes de las reglas

| Archivo | Responsabilidad |
| --- | --- |
| `shared/Constants.js` | Presets, rangos, precios, recursos, transporte, duración OI y multas. |
| `shared/EconomyFormulas.js` | Crecimiento, impuestos y condiciones de intercambio. |
| `shared/OILimits.js` | Conteo de tropas/fábricas y cálculo del exceso y multa potencial. |
| `server/src/game/PhaseManager.js` | Orden de fases, reloj y cierre de ronda. |
| `server/src/game/ActionEngine.js`, `LandMovementResolver.js` | Planificación, ejecución, reducción de activos y combate. |
| `server/src/game/DiplomacyEngine.js` | Ofertas, tratados, vencimientos y rupturas. |
| `server/src/game/FinanceEngine.js` | Mercado, transferencias, comercio y bonos. |
| `server/src/game/InternationalOrganizationEngine.js` | Propuestas, votos, efectos, duración y multas OI. |

Los tratados ordinarios y los vencimientos de bonos mantienen su plazo en `TREATY_DURATION_ROUNDS`, dentro de `server/src/game/GameStateUtils.js`. Es independiente del plazo OI.

### Ideas que aún no son reglas activas

La escolta comercial, el bloqueo costero y una acción específica para construir fortificaciones no están implementados. La defensa fija de pueblos, ciudades y capitales sí existe.

El **Casus Belli** es una idea de diseño y tiene estructuras de estado, pero no existe un sistema completo que sancione automáticamente cualquier ataque por carecer de uno. Las penalizaciones activas son las de ruptura de PNA, impago de bonos y las multas por límites OI descritas en este documento.

Una resolución adicional de **Multas del Banco Mundial** no está disponible para proponer ni votar. Esto es distinto de las multas automáticas por exceder límites OI aprobados, que sí están implementadas.
