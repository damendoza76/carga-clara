# Carga Clara

Bitácora web, en español y pensada para celular, para pronosticar la carga de una sesión y compararla con el dato real.

## Qué hace

- Guarda un rango de RPE esperado y la duración prevista; muestra la carga pronosticada como `RPE × minutos`.
- Permite cerrar la sesión con el RPE reportado por el deportista o alumno y la duración real.
- Indica si la carga real quedó dentro del rango anticipado.
- Mantiene historiales separados por persona y tipo de sesión.
- Después de dos sesiones cerradas del mismo tipo para la misma persona, propone un rango con la media de las cargas reales recientes ± su desviación absoluta media. Usa hasta las últimas cinco sesiones. La propuesta es descriptiva y el entrenador decide si la usa.
- Incluye una gráfica del historial de carga, resúmenes por persona, exportación e importación JSON y guardado local.
- Puede instalarse como PWA y conservar el armazón de la aplicación sin conexión tras la primera visita.

## Privacidad y límites

Los registros permanecen en el almacenamiento local del navegador. No hay cuenta, servidor ni sincronización automática. Exporta un respaldo para trasladar información a otro navegador o dispositivo. La fórmula de Foster cuantifica carga interna percibida; esta app no predice lesiones.

## Abrir localmente

Para probar funciones de instalación y modo sin conexión, sirve esta carpeta desde un servidor local (los service workers no funcionan al abrir el archivo directamente):

```sh
python3 -m http.server 8000
```

Luego visita `http://localhost:8000`.

## Pruebas de cálculo

Con Node.js instalado, ejecuta `node --test domain.test.js` para revisar la multiplicación Foster, la validación de entradas, el cierre dentro/fuera del rango y el cálculo de sugerencias.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub llamado `carga-clara`.
2. Sube el contenido de esta carpeta a la rama `main`.
3. En **Settings → Pages**, selecciona **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`.
4. Guarda y espera a que GitHub Pages publique el sitio.

Si el repositorio se llama `carga-clara`, la URL suele quedar bajo `https://USUARIO.github.io/carga-clara/`. No hay compilación ni dependencias que instalar.
