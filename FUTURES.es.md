# Futuros del plugin

Documento de trabajo de `opencode-deepseek-balance`. La visión es pasar de un widget de saldo a un **centro de control de gasto DeepSeek**: saldo, tendencia, gasto por sesión, presupuesto, feriados y alertas.

- Baseline: `0.2.0`.
- Entrega actual: `0.3.0`.
- Alcance de esta entrega: correcciones de precisión, robustez, empaquetado y pruebas.
- Las features de producto quedan documentadas y marcadas como pendientes.
- Leyenda: `[x]` implementado, `[ ]` pendiente.

**Visión de compatibilidad.** El plugin debe ser compatible con OpenCode 1.x y con OpenCode 2.x durante un lapso de tiempo corto: un solo código que funcione en ambas líneas durante una ventana breve de transición, en lugar de dos releases divergentes de forma permanente.

## 1. Correcciones implementadas

### Precisión de facturación

- [x] **Feriados públicos chinos.** `isPeak` ya no marca pico en un feriado chino. DeepSeek considera valle todo el día.
- [x] **Calendario en `Asia/Shanghai`.** La fecha del feriado se calcula con el día chino, no con el día UTC. Un feriado chino empieza a las 16:00 UTC del día anterior.
- [x] **Calendario 2026 oficial.** Fechas del Consejo de Estado: 1–3 ene, 15–23 feb, 4–6 abr, 1–5 may, 19–21 jun, 25–27 sep, 1–7 oct.
- [x] **Calendario 2027 provisional.** Fechas estimadas marcadas como provisionales hasta que se publique el calendario oficial.
- [x] **Estado `Holiday`.** La UI distingue pico, valle y feriado.
- [x] **Aviso de calendario desactualizado.** Si no hay datos para el año actual, la UI muestra `holiday calendar outdated`.
- [x] **Aviso de fechas provisionales.** Un feriado provisional se muestra como `Holiday*` y, durante el feriado, aparece `holiday dates provisional`.
- [x] **Búsqueda de próximo cambio ampliada.** `nextPeakChange` escanea 40 días en vez de 8, suficiente para el Festival de Primavera y los fines de semana.
- [x] **Cuenta regresiva con días.** `63h 00m` ahora se muestra como `2d 15h`.
- [x] **Hora local del próximo cambio.** La fila de precio muestra la hora local; si el cambio es otro día, añade el día abreviado.
- [x] **Reloj preciso en el límite.** El reloj sigue actualizándose cada 30 segundos, pero programa un tick exacto para el próximo cambio de pico/valle.

### Estado, caché y errores

- [x] **Último saldo persistido.** El saldo y su timestamp se guardan en `api.kv`; al abrir OpenCode se muestra inmediatamente como dato cacheado.
- [x] **No se pierde el saldo ante un fallo de red.** Si ya había un saldo, se conserva con un estado `stale` y su antigüedad.
- [x] **Versión y edad del dato.** La cabecera muestra la versión del plugin; en estado `stale` añade `cached · 2m ago` o el error actual.
- [x] **Errores tipados.** `BalanceError` distingue `no-key`, `unauthorized`, `insufficient`, `rate-limited`, `network`, `timeout`, `server`, `http`, `invalid-response` y `aborted`.
- [x] **Etiquetas claras en la UI.** `no key`, `invalid key`, `insufficient`, `rate limited`, `network error`, `timeout`, `API error`, `bad response`.
- [x] **Estado `insufficient`.** Se usa `is_available` de la API y se muestra `insufficient` cuando el saldo no cubre llamadas.
- [x] **Reintento de `no-key` más lento.** Pasa de cada 5 segundos a cada 60 segundos, sin leer el archivo de credenciales en bucle.
- [x] **Reintento de `unauthorized` más lento.** Cada 5 minutos para no martillar la API con una clave inválida.
- [x] **Backoff exponencial.** Fallos de red, timeout y servidor: 5 s, 10 s, 20 s… hasta 5 minutos.
- [x] **Jitter.** Se añade hasta 2 segundos para evitar ráfagas sincronizadas.
- [x] **`Retry-After`.** Los `429` respetan la cabecera de DeepSeek, con un mínimo de 60 segundos y un máximo de 30 minutos.
- [x] **Sin refrescos concurrentes.** Un guard de `in-flight` coalesce el timer, `session.idle` y cualquier otro intento.
- [x] **Cancelación al desactivar.** El `AbortController` cancela la petición en vuelo y no se actualiza el estado después del dispose.
- [x] **Timeout de petición.** Cinco segundos por defecto, con clasificación separada de `timeout` y `aborted`.
- [x] **Validación de la respuesta.** Se valida `is_available`, `balance_infos`, moneda, saldo total y desglose antes de aceptar el dato.
- [x] **Todas las monedas.** Se parsean todas las entradas de `balance_infos`, no solo la primera. La barra lateral muestra la primera; el desglose completo queda listo para el panel.
- [x] **Desglose disponible.** Se conservan `granted_balance` y `topped_up_balance` en el modelo, aunque todavía no se muestran en el sidebar.
- [x] **Formato monetario.** Se usa `Intl.NumberFormat` con símbolo y fallback seguro para valores o monedas inválidas.
- [x] **Credenciales cacheadas.** El archivo de auth se lee solo cuando cambia su `mtime` o tamaño, con caché por ruta.
- [x] **Dos rutas de auth.** Se revisan `$XDG_DATA_HOME/opencode/auth.json` y `$XDG_CONFIG_HOME/opencode/auth.json`.
- [x] **Formatos de auth compatibles.** Objeto antiguo (`deepseek.key`), array de integraciones (`integrationID` + `value`) y registro por ID (`deepseek`, `providerID` o `id`).
- [x] **Extracción flexible.** Se aceptan `key`, `apiKey`, `token`, `value` y `credentials` anidados.
- [x] **Variables de entorno limpias.** `DEEPSEEK_API_KEY` se recorta y se ignora si queda vacía.
- [x] **Override de auth file.** `OPENCODE_AUTH_FILE` permite apuntar a otra ubicación, útil para tests y instalaciones personalizadas.
- [x] **Precedencia documentada.** Auth de OpenCode primero; `DEEPSEEK_API_KEY` como fallback.
- [x] **Sin exponer la clave.** Los errores solo contienen estado HTTP y categoría; las pruebas verifican que la clave no aparece en el mensaje.

### UI y copy

- [x] **Capitalización correcta.** `Deepseek` → `DeepSeek`.
- [x] **Versión en la cabecera.** La versión del plugin sustituye a la edad del dato cuando el saldo está fresco.
- [x] **Última actualización visible.** En estado `stale` la antigüedad sigue visible junto al aviso.
- [x] **Columna de etiquetas fija.** Las etiquetas comparten una columna de 10 celdas para que todos los valores empiecen en la misma posición.
- [x] **Copy de precio claro.** La fila actual muestra `Peak` + `2× rate` u `Off-peak` + `50% off`; la fila `→` muestra `3h 03m · 21:30`.
- [x] **Estado de feriado visible.** `Holiday` / `Holiday*`.
- [x] **Colores semánticos.** Verde para valle, amarillo para pico, rojo para error, gris para stale.
- [x] **Sin depender solo del color.** Pico, valle, feriado, errores y antigüedad tienen texto explícito.

### Empaquetado y pruebas

- [x] **Peer dependencies.** `solid-js`, `@opentui/core`, `@opentui/keymap`, `@opentui/solid` y `@opencode-ai/plugin` quedan declarados como peers opcionales.
- [x] **Tests de balance.** Parseo, múltiples monedas, desglose, `is_available`, JSON inválido, 401, 429, 500, abort y timeout.
- [x] **Tests de credenciales.** Precedencia auth/env, trim, archivo malformado y valores vacíos.
- [x] **Tests de feriados.** Feriados chinos, frontera China/UTC, calendario oficial/provisional/ausente y salto de feriados.
- [x] **Tests de countdown.** Minutos, horas, días y fin de semana.
- [x] **Tests de hora local.** Mismo día y día siguiente.
- [x] **Tests de retry.** Backoff, topes, jitter, `Retry-After` y abort.
- [x] **Suite ejecutable en Node 22.** `npm test` usa `--experimental-strip-types` y sigue funcionando en Node 24.
- [x] **README actualizado.** Nuevo preview, features, calendario, troubleshooting y enlace a este documento.
- [x] **README.es actualizado.** Misma información en español.
- [x] **Documento de roadmap.** Este archivo.

## 2. Features pendientes para la V2

### Panel de control `/deepseek`

- [ ] Registrar un comando de paleta y slash.
- [ ] Abrir un panel o diálogo dedicado.
- [ ] Mostrar saldo total, `is_available`, `granted_balance` y `topped_up_balance`.
- [ ] Mostrar todas las monedas.
- [ ] Mostrar estado pico/valle, próximos cambios y feriados.
- [ ] Mostrar última actualización y detalle seguro del error.
- [ ] Mostrar gasto de la sesión y del día.
- [ ] Mostrar historial, tendencia y autonomía.
- [ ] Mostrar tarifas actuales de DeepSeek.
- [ ] Mostrar tasa de acierto de caché y ahorro estimado.
- [ ] Añadir un botón o comando de refresco manual con spinner y toast.

### Gasto y presupuesto

- [ ] Gasto de la sesión actual usando `message.cost` en la API 1.19 o `context.data.session.cost` en OpenCode V2.
- [ ] Gasto diario agregado.
- [ ] Desglose por modelo y por ventana pico/valle.
- [ ] Presupuesto suave por sesión.
- [ ] Presupuesto suave por día.
- [ ] Aviso al 80 % y al 100 % sin bloquear prompts por defecto.
- [ ] Marcar los importes como estimados cuando corresponda.
- [ ] Comparar el coste estimado por OpenCode con el precio efectivo de DeepSeek.

### Historial y pronóstico

- [ ] Guardar snapshots horarios o diarios.
- [ ] Limitar la retención a 90 días.
- [ ] Ignorar recargas al calcular el burn rate.
- [ ] Sparkline de 24 horas, 7 días y 30 días.
- [ ] Gasto medio diario.
- [ ] Autonomía estimada: “te quedan ~12 días”.
- [ ] Detección de recargas.
- [ ] Exportación CSV o JSON del historial.

### Ajustes y configuración

- [ ] Intervalo de refresco configurable.
- [ ] Moneda principal configurable.
- [ ] Umbral de saldo bajo.
- [ ] Umbral de autonomía mínima.
- [ ] Modo compacto o expandido.
- [ ] Idioma.
- [ ] Modo privacidad.
- [ ] Mostrar u ocultar gasto de sesión.
- [ ] Notificaciones por tipo.
- [ ] Persistencia de ajustes con `api.kv` o `context.storage`.
- [ ] Validación y migración del esquema de configuración.
- [ ] Documentar todas las opciones en el README.

### Alertas

- [ ] Saldo bajo por umbral absoluto.
- [ ] Saldo bajo por autonomía estimada.
- [ ] Clave inválida.
- [ ] API caída.
- [ ] Presupuesto de sesión superado.
- [ ] Presupuesto diario superado.
- [ ] Inicio de horario valle, opcional y desactivado por defecto.
- [ ] Cooldown para no repetir la misma alerta.
- [ ] Una sola notificación por cruce de umbral.
- [ ] Respetar el foco de la terminal con `when: "blurred"` o `when: "always"`.

### Privacidad e idioma

- [ ] Modo privacidad que oculte importes y conserve el estado pico/valle.
- [ ] Comando para activar y desactivar el modo privacidad.
- [ ] Persistencia del modo privacidad.
- [ ] Diccionario EN/ES para la UI.
- [ ] Detección de locale o ajuste manual.
- [ ] Chino simplificado como idioma adicional, opcional.
- [ ] Textos de error y troubleshooting localizados.

### Monedas

- [ ] Mostrar todas las monedas en el panel.
- [ ] Elegir la moneda principal.
- [ ] Formato local con `Intl`.
- [ ] Conversión opcional a EUR u otra moneda.
- [ ] Tipo de cambio manual por configuración.
- [ ] Proveedor externo de tipos de cambio solo con opt-in explícito.
- [ ] Actualizar la promesa de privacidad si se añade una petición externa.

### CLI y agente

- [ ] CLI `npx opencode-deepseek-balance --json`.
- [ ] Salida JSON con saldo, moneda, pico/valle, próximo cambio y errores.
- [ ] Modo `--watch` opcional.
- [ ] Tool de solo lectura `deepseek_usage` para el agente.
- [ ] Comando `/balance` que responda dentro de la sesión.
- [ ] Nota de presupuesto opcional en el contexto del agente.
- [ ] No hacer auto-routing de modelos ni bloqueo de prompts por defecto.

### Otras mejoras

- [ ] Estado compacto en `home.footer.status`.
- [ ] Acción “Configurar DeepSeek” cuando falte la clave.
- [ ] Enlace o instrucciones de recarga cuando el saldo sea insuficiente.
- [ ] Selector de múltiples cuentas o claves.
- [ ] Etiqueta de cuenta en el panel.
- [ ] Comprobación de actualización del plugin, opt-in.
- [ ] Test de contrato del paquete publicado.

## 3. Arquitectura y calidad

- [x] **Separación de responsabilidades.** `balance.ts`, `peak.ts`, `retry.ts` y `tui.tsx`.
- [x] **Errores tipados.** Sin strings mágicos en la UI.
- [x] **Funciones puras testeables.** Parseo, formato, feriados, countdown y retry.
- [x] **Inyección de dependencias en tests.** `fetchImpl`, `env`, `authFile`, locale y timezone.
- [x] **Sin dependencias nuevas de runtime.** Validación manual y APIs nativas.
- [ ] Extraer un `view-model` sin JSX para probar la UI sin renderizar.
- [ ] Extraer la máquina de estados de refresh a un módulo propio.
- [ ] Extraer la configuración a un módulo con esquema y migraciones.
- [ ] Añadir lint.
- [ ] Añadir format check.
- [ ] Añadir cobertura mínima y reporte.
- [ ] Añadir test de render de la TUI con un mock de API.
- [ ] Añadir smoke test contra una versión real de OpenCode.
- [ ] Añadir release automation con changelog y provenance.
- [ ] Añadir capturas o GIF actualizados al README.
- [ ] Añadir una tabla de configuración al README.

## 4. Migración a OpenCode V2

El repo usa `@opencode-ai/plugin@1.19.4` y OpenTUI `0.4.5`. OpenCode V2 usa `@opencode/plugin@2.x` y OpenTUI `>=0.6.8`.

**Enfoque de compatibilidad.** La visión del plugin es ser compatible con OpenCode 1.x y OpenCode 2.x a la vez durante un lapso de tiempo corto. Es una ventana de transición, no un compromiso permanente: cuando la API V2 sea estable, V2 pasa a ser el objetivo principal y se retira el soporte de 1.x.

- [ ] Mantener compatibilidad dual con OpenCode 1.x y 2.x durante un periodo corto de transición.
- [ ] Migrar `TuiPluginApi` a `Context` + `Plugin.define`.
- [ ] Migrar `api.slots.register` a `context.ui.slot`.
- [ ] Migrar `api.event.on` a `context.data.on`.
- [ ] Migrar `api.lifecycle.onDispose` al cleanup retornado por `setup`.
- [ ] Migrar `api.kv` a `context.storage`.
- [ ] Migrar `api.theme.current` a `context.theme`.
- [ ] Migrar `api.command` a `context.keymap.layer`.
- [ ] Usar `context.data.session.cost` para el gasto de sesión.
- [ ] Usar `session.panel` para el dashboard.
- [ ] Añadir entrypoint principal `"."` además de `"./tui"`.
- [ ] Añadir el entrypoint de servidor si se implementa el tool del agente.
- [ ] Actualizar `engines.opencode` y las peer dependencies.
- [ ] Publicar una major separada y mantener una rama 1.x solo si la transición lo exige.

## 5. Roadmap orientativo

| Versión | Tema | Contenido |
|---|---|---|
| `0.3` | Confianza | Feriados, countdown, hora local, errores tipados, caché, timeout, backoff, peers y tests |
| `0.4` | Control | Panel `/deepseek`, refresco manual, ajustes, gasto de sesión y alertas |
| `0.5` | Insights | Historial, sparkline, autonomía, cache hit rate, monedas, privacidad e i18n |
| `1.0` | Estabilidad | Documentación, cobertura, release automation y configuración validada |
| `2.0` | OpenCode V2 | Migración de API, `session.panel`, storage, tool del agente y multi-cuenta |

## 6. Decisiones técnicas

### Calendario de feriados

- Fuente 2026: calendario oficial del Consejo de Estado de China.
- Fuente 2027: calendario provisional; se debe reemplazar cuando se publique el oficial.
- DeepSeek considera valle los fines de semana y los feriados chinos completos, así que no se modelan los sábados de recuperación.
- La fecha se calcula en `Asia/Shanghai` con un offset fijo de +08:00; China no tiene horario de verano.
- Si falta el año actual, la UI avisa y el plugin sigue funcionando con la lógica de lunes a viernes.

### Credenciales

- Precedencia: `auth.json` de datos → `auth.json` de configuración → `DEEPSEEK_API_KEY`.
- El archivo se cachea por ruta, `mtime` y tamaño.
- Se aceptan el formato antiguo y los formatos de integraciones de OpenCode V2.
- `OPENCODE_AUTH_FILE` permite cambiar la ruta.
- La clave nunca se incluye en logs, errores ni render.

### Caché del saldo

- Clave: `opencode-deepseek-balance.balance`.
- Se guarda `{ balance, updatedAt }`.
- Un cache inválido o de una versión anterior se ignora.
- Un fallo de escritura del cache no oculta un saldo válido.

### Política de reintentos

| Error | Intervalo |
|---|---|
| `no-key` | 60 s |
| `unauthorized` | 5 min |
| `insufficient` | 60 s |
| `rate-limited` | `Retry-After` o 60 s, máximo 30 min |
| `network`, `timeout`, `server` | 5 s, 10 s, 20 s… hasta 5 min |
| `invalid-response`, `http` | 30 s, 60 s, 120 s… hasta 5 min |
| `aborted` | Sin reintento |

Se añade jitter de hasta 2 segundos.

## 7. Verificación

Comandos usados:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Resultado de esta entrega:

- [x] `npm run typecheck` sin errores.
- [x] `npm test` con 31 pruebas aprobadas.
- [x] `npm run build` compila los cinco archivos de `src`.
- [x] `npm run check` completo con Node 24 local.
- [x] `npm pack --dry-run` revisado.
- [ ] CI verde en GitHub Actions.
- [ ] Prueba manual en OpenCode con una clave real.

## 8. Cómo actualizar el calendario

1. Abrir `src/peak.ts`.
2. Localizar `HOLIDAYS`.
3. Reemplazar el año provisional por las fechas oficiales.
4. Quitar `provisional: true` de las fechas confirmadas.
5. Añadir el siguiente año cuando se publique.
6. Actualizar los tests de `test/peak.test.ts` si cambia un feriado usado en las aserciones.
7. Ejecutar `npm run check`.

## 9. Fuera de alcance por ahora

- Cambiar automáticamente de modelo según el saldo o el horario.
- Bloquear prompts por presupuesto sin una decisión explícita del usuario.
- Hacer peticiones a terceros por defecto (feriados, tipos de cambio, versiones).
- Mostrar el desglose completo en el sidebar estrecho; va en el panel.
- Enviar la clave a cualquier host que no sea `api.deepseek.com`.

## 10. Definition of done de la V2

- [ ] Panel `/deepseek` con saldo, desglose, gasto y próximo cambio.
- [ ] Refresco manual y ajustes persistentes.
- [ ] Gasto de sesión y presupuesto suave.
- [ ] Historial con tendencia y autonomía.
- [ ] Alertas de saldo bajo configurables.
- [ ] Modo privacidad.
- [ ] UI en inglés y español.
- [ ] Feriados oficiales del año en curso.
- [ ] Tests de UI y de integración.
- [ ] README con configuración y capturas actualizadas.
- [ ] Compatibilidad con OpenCode 1.x y 2.x verificada de extremo a extremo durante la ventana de transición, y luego retirada la de 1.x cuando V2 sea estable.
