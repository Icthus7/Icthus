# Icthus

Aplicación para buscar y proyectar versículos, cantos y mensajes en la iglesia. Versión 0.7.

## Lista del culto

Selecciona un canto, lectura o anuncio y pulsa **Añadir a lista** junto a la vista previa. Elige si quieres el versículo actual, un pasaje completo, todo el canto o una parte. En **Culto** puedes poner nombre a la lista y ordenar sus elementos con **Subir, Bajar y Quitar**.

Elegir un elemento solo prepara su vista previa. Su botón **Proyectar** lo envía a la pantalla. Las flechas recorren sus pantallas y luego pasan al elemento siguiente o anterior; los controles **Elemento anterior/siguiente** permiten saltar directamente. Puedes añadir o reordenar contenido durante la reunión.

La lista se guarda automáticamente en este navegador, funciona con el contenido descargado sin conexión y se incluye en la copia de datos. Los cantos completos siguen los cambios de tu biblioteca; si eliminas un canto, la lista conserva la copia que añadiste. Las copias antiguas que no incluyen lista del culto conservan la lista actual al restaurarlas.

## Modo claro y modo oscuro

Pulsa el botón de sol o luna de la parte superior para cambiar la apariencia del panel. La preferencia se guarda en este navegador y se recupera al abrir la app, también sin conexión. En pantallas pequeñas el botón muestra solo el icono; su descripción sigue disponible para lectores de pantalla. El diseño de las diapositivas se controla por separado desde **Diseño de pantalla**.

## Publicar en GitHub Pages

En **Settings → Pages**, selecciona **Deploy from a branch**, rama **main**, carpeta **/(root)** y guarda. Cuando termine la publicación, abre el enlace HTTPS que muestra GitHub.

## Instalar en Chromebook

Abre el enlace publicado en Chrome, espera **Lista sin conexión** y entra en **Aplicación → Instalar Icthus**. Si el botón no está disponible, usa el menú de Chrome: **Transmitir, guardar y compartir → Instalar página como app**.

La copia alojada en GitHub funciona sin depender de una suscripción de OpenAI. La instalación y las actualizaciones iniciales necesitan conexión. Después se puede usar el contenido descargado sin red.

## Conservar tus datos

En el enlace anterior de Icthus descarga una copia desde **Aplicación → Descargar copia de mis datos**. En el nuevo enlace, selecciona ese archivo, revisa las cantidades y pulsa **Restaurar esta copia**. Conserva respaldos fuera del navegador.

Los cantos con sus partes y orden, favoritos, historial, borradores, ajustes y lista del culto se guardan en el navegador de cada usuario. Sus copias JSON no se publican en este repositorio. Las Biblias importadas y las imágenes de fondo se vuelven a importar en el nuevo enlace. Se incluye Reina-Valera 1909; RVR1960 y TLA se activan importando archivos autorizados.

Consulta [la guía completa](LEEME-ICTHUS.md). El [paquete de código](https://github.com/Icthus7/Icthus/archive/refs/heads/main.zip) incluye todos los archivos de la aplicación listos para publicar. Los archivos de esta raíz se publican directamente, sin servidor ni proceso de compilación.
