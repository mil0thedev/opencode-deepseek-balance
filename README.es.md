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

DeepSeek Usage lee el saldo desde la API oficial de DeepSeek y muestra la ventana de facturación pico/valle en la barra lateral. Usa las credenciales de DeepSeek ya configuradas en OpenCode, se actualiza automáticamente y nunca muestra tu clave.

La fila de precio sigue las ventanas UTC de DeepSeek: `01:00–04:00` y `06:00–10:00`, de lunes a viernes. Los fines de semana son valle; los feriados públicos de China todavía no están incluidos.

## Vista previa

```text
Deepseek Usage  0.2.0
DeepSeek        9.98 USD
Off-peak        50% off · 3h 03m
```

La fila `Peak` / `Off-peak` muestra la ventana de facturación vigente y cuánto falta para el próximo cambio.

## Características

- Saldo en vivo desde el endpoint oficial `GET /user/balance` de DeepSeek.
- Ventana de facturación pico/valle con cuenta regresiva al próximo cambio.
- Actualización automática cada 60 segundos y al quedar inactiva la sesión.

## Instalación

```bash
opencode plugin opencode-deepseek-balance
```

Añade `-g` para usar la configuración global en lugar del proyecto actual. Reinicia OpenCode después de que el comando actualice `tui.json`.

> [!TIP]
> El proceso es el mismo en macOS, Linux y Windows.

Asegúrate de que DeepSeek ya esté configurado en OpenCode (`opencode auth login`) o exporta `DEEPSEEK_API_KEY` antes de iniciar OpenCode.

> [!IMPORTANT]
> Tu clave API se queda local. El plugin solo la envía a `api.deepseek.com` por HTTPS, nunca la registra ni la muestra, y no hace peticiones a terceros.

## Solución de problemas

| Síntoma | Qué revisar |
|---|---|
| El bloque no aparece | Reinicia OpenCode y confirma la ruta registrada en `tui.json`. |
| `…` | La primera petición de saldo sigue pendiente; espera unos segundos. |
| `n/a` | Clave ausente o ilegible, error HTTP o fallo de red. |
| El saldo no se actualiza al instante | El refresco normal es cada 60 segundos; `session.idle` también solicita uno. |
| Aparecen dos bloques idénticos | El plugin está registrado en el `tui.json` global y en el del proyecto; déjalo en un solo alcance. |

## Roadmap

Este roadmap separa mis próximas metas de las ideas que surgieron durante el desarrollo. Las sugerencias de DeepSeek son opciones, no compromisos con fecha.

### Mis próximas metas

| Estado | Meta | Detalle |
|---|---|---|
| Siguiente | Gasto estimado por sesión (USD) | Ver cuánto ha gastado la sesión actual hasta ahora, junto al saldo. |
| Planificada | Moneda de preferencia | Mostrar el saldo en tu moneda preferida en lugar de USD. |

### Sugerencias de DeepSeek

| Estado | Idea | Detalle |
|---|---|---|
| Explorar | Calendario de feriados públicos de China | Mantener el indicador pico/valle correcto en esos días. |
| Explorar | Intervalo de refresco configurable | Ajustar los 60 segundos de refresco y los 5 segundos de reintento. |
| Explorar | Desglose del saldo | Mostrar `granted_balance` y `topped_up_balance`, no solo el total. |
| Explorar | Refresco manual | Añadir una acción en la paleta de comandos para consultar el saldo al instante. |
| Explorar | Estados de error más claros | Cambiar `n/a` por `sin clave` o `error de red`, sin exponer la clave ni la respuesta. |
| Explorar | Mostrar todas las monedas | Usar todas las entradas de `balance_infos` en lugar de solo la primera. |
