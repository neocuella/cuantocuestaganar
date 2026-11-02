# ¿Cuánto cuesta ganar? Tatakua 2026

Cuánto invirtió cada agencia en inscripciones finalistas del Festival Tatakua 2026, cuántos metales ganó y cuánto le costó cada metal.

Sitio: https://cuantocuestaganar.rickovelar.com

> Esta no es una herramienta oficial de El Círculo de Creativos del Paraguay ni del Festival Tatakua. Es un cálculo independiente hecho con información pública. Todas las marcas mencionadas pertenecen a sus respectivos dueños.

## Para qué sirve

Es un proyecto educativo. Busca dos cosas:

1. **Mostrar el costo de competir.** Los premios se celebran en el escenario, pero la inversión en inscripciones no se ve. Para una agencia chica esa plata pesa, y conviene mirarla antes de decidir cuánto inscribir.
2. **Mostrar qué se puede hacer con datos abiertos, y qué no.** El festival no publica sus datos en un formato reutilizable (CSV, Excel, JSON). Este repo junta lo que es público, lo convierte en datos abiertos y deja escrito cada supuesto, para que cualquiera pueda revisarlo, corregirlo o repetirlo con otro año u otro festival.

No es un ranking oficial, no es una auditoría y no acusa a nadie. Todos los montos son **mínimos**: solo cuentan las inscripciones que quedaron finalistas.

## Los datos

En `site/data/`.

| Archivo | Una fila por | Contenido |
|---|---|---|
| `inscriptos-2026.csv` | inscripto (agencia o productora) | ideas, finalistas, inversión, oro/plata/bronce, Gran Tatakua, puntos, Gs. por metal, Gs. por punto, premio del año |
| `ideas-2026.csv` | idea (mismo título y mismo inscripto) | marca, finalistas, inversión, metales, finalistas sin metal, puntos |
| `finalistas-2026.csv` | inscripción finalista, tal como figura en el shortlist | bloque, categoría, subcategoría, idea, inscripto, marca, formato, costo |
| `shortlist-2026.json` | inscripción finalista | lo mismo que `finalistas-2026.csv`, en JSON (lo usa el sitio) |
| `metals-2026.json` | metal | medalla, idea e inscripto, y la URL de donde sale |

Los CSV están en UTF-8 con BOM (para que Excel respete los acentos), separados por coma y con los montos en guaraníes, sin separador de miles. Si Excel en español los abre todos en una columna, importalos desde Datos > Desde texto/CSV y elegí coma como separador.

`tipo_inscripto` separa agencias de productoras. El sitio muestra solo agencias en la parte principal y las productoras en un anexo (ver limitaciones).

Resumen 2026: 192 finalistas (163 de 17 agencias, 29 de 7 productoras), 105 ideas y 81 metales (7 oros, 36 platas, 38 bronces). La inversión de las agencias en finalistas suma Gs. 116.050.000.

## Cómo se juntaron

| Fuente | Qué aporta |
|---|---|
| [Shortlist 2026](https://ugc.production.linktr.ee/0d5e348f-0ac4-4fae-b1ae-22009f35f5b8_TTK-2026-Shortlist-FINAL.pdf) (PDF del festival, copia en `docs/finalistas2026.pdf`) | finalistas con categoría, subcategoría, idea, inscripto y marca |
| [Bases y condiciones 2026](https://elcirculo.org.py/archivos/bases_condiciones_tatakua_2026.pdf) (copia en `docs/`) | costos de inscripción y escala de puntos |
| [AdLatina](https://www.adlatina.com/publicidad/tatakua-2026-oniria-tbwa-la-mejor-agencia-y-23-sports-la-indie-del-ao) | lista de ganadores, de donde salen los metales |
| [TotalMedios](https://www.totalmedios.com/nota/65680/oniriatbwa-fue-elegida-agencia-del-ano-en-tatakua-2026) | total de ≈800 inscripciones; segunda lista de ganadores para cruzar |
| [Diario HOY](https://www.hoy.com.py/negocios/2026/10/27/oniriatbwa-la-mejor-agencia-del-paraguay-en-el-festival-tatakua), [El Nacional](https://elnacional.com.py/lifestyle/oniriatbwa-conquista-su-decimosexto-titulo-mejor-agencia-tatakua-n114313) | cruce de metales y finalistas de Oniria TBWA; premios del año |
| [Revista Plus](https://revistaplus.com.py/2026/10/28/veintitres-sports-hace-historia-es-la-mejor-agencia-independiente-del-tatakua-2026/), [1000 Noticias](https://1000noticias.com.py/2026/10/29/veintitres-sports-marketing-se-consagra-como-mejor-agencia-independiente-en-tatakua-2026/) | reportan 6 bronces para Veintitrés, uno más que AdLatina |

Pasos:

1. `scripts/parse-shortlist.py` lee el PDF del shortlist con `pdftotext`, columna por columna, y deja cada finalista bajo la subcategoría impresa arriba. A cada uno le asigna el costo según la subcategoría diga "pieza", "campaña" o sea integrada (IN1).
2. `scripts/parse-metals.py` toma la nota de AdLatina y une cada metal con su idea del shortlist (título + inscripto). Falla si un metal no encuentra su idea, o si una idea tiene más metales que finalistas.
3. `scripts/export-csv.py` arma los CSV con las mismas reglas que el sitio.
4. Los premios del año (Agencia, Agencia Independiente, Productora, Anunciante y Gran Tatakua) están escritos a mano en `site/app.js` y en `scripts/export-csv.py`, a partir de la prensa.

## Reglas del cálculo

- **Costo por inscripción** (bases 2026, IVA incluido): pieza Gs. 660.000, campaña Gs. 880.000, campaña integrada Gs. 990.000.
- **Inversión** = suma de los costos de las inscripciones finalistas.
- **Idea** = mismo título de proyecto y mismo inscripto. Una idea puede tener varias inscripciones en distintas subcategorías.
- **Puntos** (escala de las bases): Gran Tatakua 15, Oro 9, Plata 6, Bronce 3, Finalista 1. Un metal reemplaza el punto de finalista de esa inscripción. El Gran Tatakua se suma al oro de su idea (oro + Gran Tatakua = 24).
- **Gs. por metal** = inversión / metales. Solo para inscriptos con al menos un metal.
- **Gs. por punto** = inversión / puntos.

## Limitaciones

Leé esto antes de citar un número.

- **Solo finalistas.** El festival tuvo ≈800 inscripciones y solo 192 quedaron finalistas. Las que no quedaron no son públicas, así que la inversión real de cada inscripto es mayor que la de acá. Las comparaciones entre agencias pueden cambiar mucho con esos datos.
- **≈800 es aproximado.** Sale de la prensa, no de un dato oficial. Los porcentajes del sitio dependen de ese número.
- **Formato supuesto.** 119 de las 192 inscripciones están en subcategorías que no dicen si son pieza o campaña, y se cuentan como pieza (`pieza (asumido)` en los datos, `*` en el sitio). Si alguna fue campaña, el monto real es mayor.
- **Sin recargos.** No incluye el recargo por inscripción tardía (Gs. 100.000), porque no se sabe quién lo pagó.
- **Metales por idea, no por inscripción.** La lista de ganadores no detalla todas las subcategorías, así que cada metal se asigna a la idea. Por eso `finalistas-2026.csv` no tiene columna de metal.
- **Falta un bronce.** Otros medios reportan 6 bronces para Veintitrés y la lista de AdLatina trae 5. Los datos usan 5.
- **Productoras incompletas.** Las bases también les dan puntos en Mensajes Audiovisuales y de Audio por piezas que inscribieron agencias, y el shortlist no las nombra ahí. Su puntaje no se puede reconstruir, por eso van aparte. La lista de productoras está escrita a mano.
- **Los puntos no son el ranking oficial.** Las bases excluyen a las agencias de las categorías de técnicas de producción y suman créditos individuales. Acá se usan como referencia.
- **Nombres tal cual el shortlist.** El inscripto es el nombre que figura en el PDF. No se agrupan redes ni holdings, y no se corrigen variantes de escritura.
- **El parser depende del diseño del PDF.** Si cambia la maquetación (columnas, márgenes, orden), `parse-shortlist.py` hay que ajustarlo.

## Replicarlo

Requisitos: Python 3 y `pdftotext` (poppler, `brew install poppler` en macOS). Para publicar en Cloudflare, Node.js. Para la imagen para compartir, Google Chrome.

```sh
# 1. Shortlist → JSON
python3 scripts/parse-shortlist.py docs/finalistas2026.pdf site/data/shortlist-2026.json

# 2. Metales desde AdLatina
curl -sL -A "Mozilla/5.0" "https://www.adlatina.com/publicidad/tatakua-2026-oniria-tbwa-la-mejor-agencia-y-23-sports-la-indie-del-ao" -o /tmp/adlatina.html
python3 scripts/parse-metals.py /tmp/adlatina.html site/data/shortlist-2026.json site/data/metals-2026.json

# 3. CSV
python3 scripts/export-csv.py site/data/shortlist-2026.json site/data/metals-2026.json site/data

# 4. Ver el sitio en http://localhost:8770
python3 -m http.server 8770 --directory site
```

El sitio es HTML, CSS y JavaScript sin dependencias ni build: `site/index.html`, `site/styles.css` y `site/app.js`.

Publicar (Cloudflare Workers con assets estáticos, configuración en `wrangler.jsonc`; cambiá `name` y `routes` por los tuyos):

```sh
npx wrangler deploy
```

Imagen para compartir (`site/og.jpg`) e ícono para iPhone (`site/apple-touch-icon.png`): se generan con Chrome desde `scripts/share-image.html` y `scripts/touch-icon.html`. El total está escrito en `share-image.html`; actualizalo si cambian los datos.

```sh
sh scripts/render-share-image.sh
```

### Para otro año u otro festival

- **Costos:** `FEE_PIEZA`, `FEE_CAMPANA` y `FEE_INTEGRADA` en `scripts/parse-shortlist.py`, y la regla que decide el formato según la subcategoría.
- **Diseño del PDF:** `PAGES` y `COLUMNS` en `scripts/parse-shortlist.py`, y los códigos de `BLOCKS` y `CATEGORIES`.
- **Metales:** `scripts/parse-metals.py` está hecho para el formato de la nota de AdLatina. Otra fuente necesita otro parser que deje el mismo JSON.
- **Puntos, productoras y premios del año:** `POINTS`, `PRODUCTORAS` y `WINNERS` en `site/app.js`, y sus equivalentes en `scripts/export-csv.py` (mantenerlos iguales).
- **Textos fijos:** total aproximado de inscripciones y fecha de cierre (`TOTAL_ENTRIES_APPROX`, `CLOSE_DATE` en `site/app.js`), la letra chica de costos (`FINE_PRINT`), las notas de método y la fecha de "Última actualización" en `site/index.html`.

## Estructura

```
site/            sitio publicado (HTML, CSS, JS, datos, imágenes)
site/data/       datos: JSON que usa el sitio y CSV
scripts/         parsers, exportación a CSV e imágenes para compartir
docs/            PDFs fuente (shortlist y bases), copias de los originales
wrangler.jsonc   configuración de Cloudflare
```

## Correcciones

Si encontrás un error o tenés datos que faltan (inscripciones no finalistas, formatos reales), abrí un issue o escribime por [email](mailto:hola@rickovelar.com).

## Licencia

- Código: [MIT](LICENSE).
- Datos derivados (`site/data/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es). Podés usarlos y modificarlos citando la fuente.
- Los PDFs de `docs/` son documentos del festival y se incluyen solo para poder reproducir el cálculo; sus derechos son de sus autores. Las notas de prensa enlazadas pertenecen a sus medios.
