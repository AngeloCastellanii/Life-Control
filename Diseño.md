Contexto de Diseño UI/UX (Plantilla Genérica para Web Apps)
Arquitectura Visual y Layouts del Sistema

La aplicación se estructura bajo un patrón de "Layout Constante con Escenario Dinámico". En resoluciones de escritorio, existe un panel lateral de navegación (Sidebar) fijo que ocupa el 20% de la pantalla, dejando el 80% restante para el escenario dinámico. En resoluciones móviles, el menú lateral colapsa para convertirse en una barra de navegación inferior (Bottom Tab Bar).

Las acciones principales de creación se centralizan en un Botón Flotante (FAB - Floating Action Button) ubicado en la esquina inferior derecha. Al interactuar con él, el fondo de la aplicación aplica un efecto de desenfoque (blur) y un Modal Universal se superpone en el centro, permitiendo el ingreso de datos sin redireccionar al usuario a una nueva página.

Distribución exacta por módulos:

Módulo Principal (Dashboard): * Layout: Formato de cuadrícula (Grid).

Distribución: La sección superior actúa como un panel de indicadores clave (KPIs) mediante tarjetas anchas. Estas incluyen gráficos circulares (SVG) dinámicos y tipografía de gran escala para métricas numéricas destacadas. La sección inferior se divide en dos columnas enfrentadas que muestran listas resumidas de los registros más recientes o de mayor prioridad, permitiendo acceso rápido.

Área de Trabajo (Gestor de Entidades): * Layout: Pantalla Dividida (Split-Screen).

Distribución: El 70% izquierdo es un lienzo dinámico donde se apilan verticalmente los contenedores principales del sistema. El 30% derecho es un panel lateral fijado que funciona como "Bandeja de Entrada" o repositorio de elementos sin asignar. La interacción principal se basa en Drag & Drop (arrastrar y soltar) desde el panel derecho hacia los contenedores de la izquierda.

Módulo Comparativo (Balance Visual): * Layout: Balanza de dos columnas enfrentadas.

Distribución: Diseñado para contrastar dos conjuntos de datos opuestos (ej. Entradas vs. Salidas, Positivos vs. Negativos). La columna izquierda agrupa los registros del primer tipo con acentos visuales en un color cálido o de advertencia, mientras que la columna derecha muestra el tipo opuesto con acentos en colores fríos o de confirmación. Incluye interactividad para marcar elementos como "procesados", aplicando una escala de grises y opacidad para diferenciarlos visualmente.

Tablero de Estados (Kanban / Matriz): * Layout: Tablero de columnas rígidas.

Distribución: La pantalla se divide en columnas de izquierda a derecha que representan diferentes fases, estados o frecuencias de tiempo. Dentro de cada columna se alojan tarjetas simples con casillas de verificación (checkboxes) o botones de acción rápida, optimizadas para listas de control y flujos de procesos.

Panel de Configuración (Categorías/Etiquetas): * Layout: Lista vertical centrada.

Distribución: Orientado a la simplicidad. Filas horizontales apiladas en el centro del escenario, donde cada fila representa una categoría o atributo global del sistema. Cada elemento cuenta con un selector de color interactivo y un campo de texto, permitiendo que el resto de los módulos del sistema hereden estas configuraciones visuales.