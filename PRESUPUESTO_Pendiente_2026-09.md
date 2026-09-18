# Presupuesto: módulos pendientes de Marginbite

**Para:** Steven
**Preparado por:** Pablo · Marginbite
**Fecha:** septiembre 2026

---

## De dónde sale este documento

El spec técnico que me pasasteis define nueve fases. A día de hoy están cerradas y funcionando las fases 1, 2, 3 y 9:

- **Fase 1.** Catálogo cerrado de unidades con su magnitud física. La unidad base ya no es texto libre y el sistema rechaza mezclar kilos con litros.
- **Fase 2.** Ingrediente con unidad validada, proveedor, almacén, histórico de precios y ficha viva.
- **Fase 3.** Escandallo con **elaboraciones intermedias** (una salsa madre es una receta que se usa dentro de otras, anidable sin límite) y **merma por ingrediente** aplicada al coste. Recién entregado.
- **Fase 9.** Contrato de "sin datos": la plataforma no inventa un número cuando no tiene información, lo dice.

Lo que sigue es lo que queda de las fases 4 a 8, más los cuatro módulos que quedaron identificados en los informes anteriores.

---

## Los módulos

### A. Ciclo de compra completo (fases 4, 5 y 6)

Hoy los pedidos, albaranes y facturas existen pero viven sueltos: nada dice que este albarán venga de aquel pedido, ni que esta factura cubra esos tres albaranes.

- Estados de pedido: borrador, enviado, recibido, cerrado, con las transiciones controladas
- Recepción contra pedido: lo pedido frente a lo servido, con las diferencias señaladas
- Factura que agrupa varios albaranes, con el cuadre de importes
- Control de duplicados por número de documento y proveedor

**Estimación: 8 días.**

### B. Inventario y movimientos de stock (fases 7 y 8)

El módulo grande, y el que hace que el resto cobre sentido.

- Movimientos: entrada por albarán, salida por producción, merma, ajuste y traspaso entre almacenes
- Stock actual por almacén y valoración del inventario
- Hoja de recuento: congelar, contar, comparar contra el teórico y generar los ajustes
- Enganche automático con lo que ya existe: recibir un albarán suma stock, producir una receta lo resta descomponiendo sus elaboraciones hasta el último ingrediente, registrar una merma lo descuenta

**Estimación: 14 días.**

### C. Formatos de compra

Comprar "una caja de 6 botellas de 75 cl" y que el sistema sepa solo que son 4,5 litros, en el catálogo, en el escaneo de albaranes, en los pedidos y en el escandallo.

**Estimación: 4,5 días.**

### D. Horas reales y fichajes

La plataforma calcula hoy el coste laboral sobre las horas planificadas. Esto permite capturar las reales.

- Fichaje de entrada y salida, con corrección manual y trazabilidad del cambio
- Plan frente a real, con las desviaciones señaladas
- Productivity pasa a calcularse sobre horas reales

**Estimación: 6 días.**

### E. Planificador de horarios

- Cuadrante semanal por centro, con plantillas reutilizables
- Reglas de descanso, horas de contrato y solapes
- Coste proyectado del cuadrante frente a la venta prevista
- Publicación y aviso al equipo

**Estimación: 9,5 días.**

### F. Informes programados

Los destinatarios ya están configurados por rol y por centro. Falta la frecuencia y el envío automático, con su histórico.

**Estimación: 3,5 días.**

### G. Aplicación instalable en el móvil

Instalación en el teléfono, cámara para escanear albaranes en recepción y consulta sin cobertura.

**Estimación: 3 días.**

---

## Resumen

| Módulo | Días | Importe |
|---|---:|---:|
| A. Ciclo de compra completo | 8 | |
| B. Inventario y movimientos de stock | 14 | |
| C. Formatos de compra | 4,5 | |
| D. Horas reales y fichajes | 6 | |
| E. Planificador de horarios | 9,5 | |
| F. Informes programados | 3,5 | |
| G. Aplicación instalable | 3 | |
| **Total** | **48,5** | |

Son unas **diez semanas de trabajo**. No hace falta contratarlo entero: cada módulo funciona por su cuenta y se puede ir por partes.

---

## Mi recomendación de orden

**Primero A y B juntos, como un solo bloque.** El inventario sin el ciclo de compra cerrado no cuadra nunca, porque las entradas de stock nacen de los albaranes. Son los dos módulos que de verdad cambian el día a día de la cocina, y el resto puede esperar.

C, D, E, F y G son mejoras sobre algo que ya funciona. Se pueden pedir sueltas y en cualquier orden.

---

## Condiciones

- **Plazos** desde la confirmación, no desde la fecha de este documento.
- Cada módulo incluye **dos semanas de ajustes** con vuestros datos reales una vez entregado. Pasado ese plazo, los cambios de alcance se valoran aparte.
- Los módulos A y B tocan datos existentes, así que **antes de empezar hay que tener el despliegue automático funcionando y una copia de seguridad del histórico**.

---

*Documento de estimación. Los días son firmes; el importe por día lo fijamos al confirmar.*
