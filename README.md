# Carga Clara

Bitácora web, en español y pensada para celular, para pronosticar la carga de una sesión y compararla con el dato real.

## Qué hace

- Guarda un único RPE pronosticado y la duración prevista; muestra la carga pronosticada como `RPE × minutos`.
- Permite cerrar la sesión con el RPE reportado por el deportista o alumno y la duración real.
- Compara la carga pronosticada con la real y calcula el error absoluto en unidades `RPE × minutos`.
- Mantiene historiales separados por persona y tipo de sesión.
- Con una o más sesiones cerradas del mismo tipo para la misma persona, recomienda una carga para la siguiente sesión usando la actualización recursiva `expectativa anterior + (1/n) × (carga real − expectativa anterior)`. `n` es el número de la sesión comparable y se usa todo el historial en orden cronológico. Por ejemplo, si la expectativa tras nueve sesiones es 400 y la décima carga real es 250, recomienda 385 para la siguiente. También convierte esa carga a un RPE para los minutos previstos.
- Grafica carga pronosticada y real a lo largo del tiempo; incluye resúmenes por persona, exportación/importación CSV, respaldo JSON y guardado local.
- Puede instalarse como PWA y conservar el armazón de la aplicación sin conexión tras la primera visita.

## Privacidad y límites

Los registros permanecen en el almacenamiento local del navegador. No hay cuenta, servidor ni sincronización automática. Exporta un respaldo para trasladar información a otro navegador o dispositivo. La fórmula de Foster cuantifica carga interna percibida; esta app no predice lesiones.

## Licencia

Carga Clara se distribuye con la licencia MIT. Puedes usar, copiar, modificar, publicar y distribuir el software, incluso con fines comerciales, siempre que conserves el aviso de copyright y el texto de la licencia. Se ofrece sin garantía; consulta el archivo [LICENSE](LICENSE).

## Abrir localmente

Para probar funciones de instalación y modo sin conexión, sirve esta carpeta desde un servidor local (los service workers no funcionan al abrir el archivo directamente):

```sh
python3 -m http.server 8000
```

Luego visita `http://localhost:8000`.

## CSV y respaldos

El CSV de Carga Clara usa las columnas `id`, `persona_id`, `persona`, `tipo_sesion`, `fecha_sesion`, `rpe_pronosticado`, `minutos_previstos`, `carga_pronosticada`, `estado`, `rpe_reportado`, `minutos_reales`, `carga_real`, `creado_en` y `cerrado_en`. Al importar, se agregan sesiones nuevas y se omiten IDs ya existentes. Acepta separador por coma o punto y coma. Los pronósticos con rangos de versiones previas se conservan mediante su punto medio.

## Pruebas

Con Node.js instalado, ejecuta `node --test domain.test.js` para revisar la carga de Foster, la actualización de la expectativa, el error del pronóstico, la migración y el intercambio CSV.

## GitHub Pages

El sitio de este repositorio se publica desde la rama `main` y la carpeta raíz. Su dirección es `https://damendoza76.github.io/carga-clara/`.

No hay compilación ni dependencias que instalar. Cada actualización en `main` inicia una nueva publicación.
