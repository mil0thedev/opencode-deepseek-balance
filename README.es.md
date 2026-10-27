<p align="right">
  <a href="README.md">English</a> | <strong>Español</strong>
</p>

<p align="center">
  <img src="assets/banner.es.webp" alt="opencode-deepseek-balance: saldo de DeepSeek y tarifa pico/valle en la barra lateral de OpenCode" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licencia: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square"></a>
  <a href="https://opencode.ai"><img alt="OpenCode >= 1.19" src="https://img.shields.io/badge/opencode-%E2%89%A51.19-111111?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/opencode-deepseek-balance"><img alt="npm" src="https://img.shields.io/npm/v/opencode-deepseek-balance?style=flat-square"></a>
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=ts,solidjs,bun,babel,npm" alt="TypeScript, SolidJS, Bun, Babel, npm">
</p>

Monitorea tu saldo de DeepSeek y sabe si estás en hora pico, desde la barra lateral de OpenCode.

DeepSeek Usage lee el saldo desde la API oficial de DeepSeek y muestra la ventana de facturación pico/valle en la barra lateral. Usa las credenciales de DeepSeek ya configuradas en OpenCode, se actualiza automáticamente, conserva el último saldo conocido mientras estás sin conexión y nunca muestra tu clave.

La fila de precio sigue las ventanas UTC de DeepSeek: `01:00–04:00` y `06:00–10:00`, de lunes a viernes. Los fines de semana y los feriados públicos chinos son valle. El calendario incluido contiene las fechas oficiales de 2026 y las fechas provisionales de 2027; los feriados provisionales se marcan con `*` y el plugin avisa cuando no hay datos para el año actual.

## Vista previa

```text
DeepSeek Usage 0.3.0
DeepSeek   $9.98
Off-peak   50% off
→ Peak     3h 03m · 21:30
```

La fila `Peak` / `Off-peak` / `Holiday` muestra la ventana de facturación vigente y su tarifa. La fila `→` muestra la próxima ventana, cuánto falta para el cambio y la hora local de ese cambio en formato de 24 horas.

## Características

- Saldo en vivo desde el endpoint oficial `GET /user/balance` de DeepSeek.
- Ventana de facturación pico/valle con cuenta regresiva al próximo cambio.
- Calendario de feriados públicos chinos: fechas oficiales de 2026 y provisionales de 2027.
- Último saldo conocido persistido y visible mientras se actualiza o no hay conexión, con su antigüedad.
- Estados de error claros: `no key`, `invalid key`, `insufficient`, `rate limited`, `network error`, `timeout`, `API error`, `bad response`.
- Timeout de cinco segundos, cancelación al desactivar el plugin y una sola petición en vuelo a la vez.
- Backoff exponencial con jitter para fallos transitorios y soporte de `Retry-After` para límites de tasa.
- Actualización automática cada 60 segundos y al quedar inactiva la sesión.
- Se leen todas las entradas de `balance_infos`; la barra lateral muestra la primera y el desglose completo queda listo para el panel de la V2 en [`FUTURES.es.md`](FUTURES.es.md).

## Instalación

```bash
opencode plugin opencode-deepseek-balance
```

Añade `-g` para usar la configuración global en lugar del proyecto actual. Reinicia OpenCode después de que el comando actualice `tui.json`.

> [!TIP]
> El proceso es el mismo en macOS, Linux y Windows.

Asegúrate de que DeepSeek ya está configurado en OpenCode (`opencode auth login`) o exporta `DEEPSEEK_API_KEY` antes de iniciar OpenCode.

> [!IMPORTANT]
> Tu clave API se queda local. El plugin solo la envía a `api.deepseek.com` por HTTPS, nunca la registra ni la muestra, y no hace peticiones a terceros.

## Calendario de feriados

DeepSeek factura los feriados públicos chinos como valle durante todo el día. El plugin comprueba la fecha del feriado en `Asia/Shanghai`, porque el día del calendario chino empieza a las 16:00 UTC del día anterior.

- 2026: fechas oficiales del Consejo de Estado.
- 2027: fechas provisionales hasta que el Consejo de Estado publique el calendario oficial. Los feriados de ese año se muestran como `Holiday*`.
- 2028 en adelante: la barra lateral muestra `holiday calendar outdated` hasta que se actualice el plugin.

Si aparece el aviso del calendario, actualiza el plugin para obtener las fechas más recientes. El calendario completo vive en `src/peak.ts`.

## Solución de problemas

| Síntoma | Qué revisar |
|---|---|
| El bloque no aparece | Reinicia OpenCode y confirma la ruta registrada en `tui.json`. |
| `checking…` | La primera petición de saldo sigue pendiente; espera unos segundos. |
| `no key` | DeepSeek no está configurado en OpenCode y `DEEPSEEK_API_KEY` no está definida. |
| `invalid key` | La clave guardada fue rechazada. Ejecuta `opencode auth login` de nuevo o reemplaza `DEEPSEEK_API_KEY`. |
| `insufficient` | DeepSeek indica que el saldo no cubre llamadas a la API. Recarga tu cuenta. |
| `network error`, `timeout`, `API error` | Problema temporal de conectividad o del servidor. El plugin reintenta con backoff. |
| `rate limited` | DeepSeek devolvió `429`; el plugin respeta `Retry-After` y reintenta más tarde. |
| `bad response` | La API devolvió un JSON que el plugin no entiende. Actualiza el plugin. |
| El estado muestra `cached · …` o una antigüedad | Se está mostrando el último saldo conocido mientras falla una actualización. Revisa la conexión. |
| `Holiday*` o `holiday dates provisional` | El calendario de 2027 es provisional; actualiza el plugin cuando se publique el calendario oficial. |
| `holiday calendar outdated` | El calendario no tiene datos para el año actual. Actualiza el plugin. |
| El saldo no se actualiza al instante | El refresco normal es cada 60 segundos; `session.idle` también solicita uno. |
| Aparecen dos bloques idénticos | El plugin está registrado en el `tui.json` global y en el del proyecto; déjalo en un solo alcance. |

## Roadmap

El checklist completo de la V2 — correcciones ya implementadas, features en evaluación, arquitectura y migración a OpenCode V2 — está en [`FUTURES.es.md`](FUTURES.es.md).

Próximas metas:

| Estado | Meta | Detalle |
|---|---|---|
| Siguiente | Gasto estimado por sesión (USD) | Ver cuánto ha gastado la sesión actual hasta ahora, junto al saldo. |
| Planificada | Moneda de preferencia | Mostrar el saldo en tu moneda preferida en lugar de la primera entrada de la API. |
| Explorar | Panel e historial | Desglose del saldo, tendencia de gasto, autonomía y calendario pico/valle en un panel dedicado. |
