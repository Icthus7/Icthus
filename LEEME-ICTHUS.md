# Icthus en tu Chromebook

Esta copia funciona como aplicación web instalable (PWA). El ZIP contiene los archivos para publicarla; no es un instalador ejecutable. Una vez publicada en tu cuenta de GitHub, su funcionamiento no depende de tu suscripción de OpenAI.

## 1. Conserva tus datos

En el enlace actual de Icthus abre **Aplicación → Descargar copia de mis datos**. Guarda el archivo JSON en tu Chromebook. Incluye cantos con partes y orden, favoritos, historial, borradores y ajustes. No subas esta copia personal a GitHub.

Las Biblias importadas y las imágenes de fondo se vuelven a importar en el nuevo enlace. La aplicación incluye RV1909. RVR1960 y TLA se activan con tus archivos autorizados, guardados solo en tu navegador.

## 2. Publica en GitHub Pages

1. En tu cuenta de GitHub crea un repositorio llamado **icthus**. GitHub Pages gratuito requiere un repositorio público. El programa quedará visible para cualquier persona; tus datos del navegador no se publican.
2. Extrae **icthus-independiente.zip**.
3. Sube el contenido extraído a la raíz del repositorio, sin una carpeta contenedora. No subas solo el ZIP: deben aparecer `index.html`, `sw.js`, `manifest.webmanifest`, `app-icons/`, `data/` y los demás archivos. Conserva el archivo vacío `.nojekyll`.
4. En el repositorio abre **Settings → Pages**. Selecciona **Deploy from a branch**, rama **main**, carpeta **/(root)** y guarda.
5. Espera a que GitHub muestre el enlace publicado. Abre ese enlace HTTPS en Chrome desde tu Chromebook.

## 3. Instala desde el nuevo enlace

1. Espera el aviso **Lista sin conexión**.
2. Abre **Aplicación → Instalar Icthus** si el botón está disponible. También puedes usar el menú de Chrome: **Transmitir, guardar y compartir → Instalar página como app**. El texto puede variar según tu versión de Chrome.
3. Abre Icthus desde el lanzador de tu Chromebook.
4. En **Aplicación**, selecciona tu copia JSON, revisa las cantidades y pulsa **Restaurar esta copia**. Reemplaza los datos locales de ese enlace.
5. Reimporta tu Biblia y tu imagen de fondo si las usabas.

## 4. Comprueba el modo sin conexión

Con internet, abre una vez tanto el panel como **Abrir proyección**. Espera **Lista sin conexión**. Luego desconecta la red, vuelve a abrir Icthus y comprueba una búsqueda, un canto y la proyección. Las descargas nuevas, actualizaciones e importaciones desde URL necesitan internet; el contenido ya guardado funciona sin red.

Tus datos pertenecen al navegador, perfil, equipo y enlace donde los guardas. Borrar los datos del sitio o cambiar de equipo puede eliminarlos. Conserva copias JSON fuera del navegador y vuelve a descargarlas después de agregar cantos.

## Modo claro y modo oscuro

En la parte superior, usa el botón de sol o luna para elegir la apariencia del panel. Icthus conserva esa elección en este navegador, también sin conexión. Puedes volver a cambiarla cuando quieras. El estilo de las diapositivas se sigue eligiendo en **Diseño de pantalla**.

## Actualizaciones

Sustituye los archivos del repositorio por la nueva versión. Abre Icthus con internet para descargar la actualización y vuelve a abrirla después. Conserva tu copia de datos antes de actualizar.

Ayuda oficial: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) y [aplicaciones web en Chromebook](https://support.google.com/chromebook/answer/9658361?hl=es-419).
