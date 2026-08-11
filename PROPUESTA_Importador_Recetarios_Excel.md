# Propuesta — Importador de recetarios (Excel) + ficha de escandallo estructurada

**Para:** Connatura y clientes sin software de gestión
**Preparado por:** Pablo · Marginbite
**Fecha:** agosto 2026
**Tipo:** Alcance nuevo (fuera del MVP entregado) — se presupuesta aparte

---

## Contexto

Connatura no tiene tSpoonLab ni ningún sistema del que exportar por API: sus recetas y escandallos viven en Excel. Para incorporar este tipo de clientes hace falta poder **cargar los recetarios de golpe desde Excel** en vez de meterlos uno a uno a mano, y que al hacerlo **el catálogo de ingredientes se cree y actualice solo**.

Este documento cubre dos entregables que terminan generando exactamente el mismo escandallo dentro de Marginbite.

---

## Qué incluye

### 1. Importador de recetarios desde Excel
Subes uno o varios escandallos en `.xlsx` y Marginbite lee:
- Nombre y categoría de la receta
- Producción base, porciones y rendimiento
- Ingredientes: cantidad, unidad y merma
- Precio, proveedor y almacén *cuando aparezcan en el archivo*
- Alérgenos, procedimiento y observaciones

**Pantalla de revisión antes de guardar** (nada se guarda a ciegas):
- Relaciona cada ingrediente con los que ya existen en el catálogo (coincidencia por nombre)
- Crea como **borrador** los ingredientes que no existan
- Confirma unidades y conversiones (g/kg, ml/l, ud…)
- Asigna almacén y completa proveedor si el archivo lo trae
- Marca las filas incompletas o con errores para que las revises

**Al aprobar:** crea el/los escandallo(s) con sus líneas estructuradas **y da de alta / actualiza los ingredientes en el catálogo automáticamente.** (Respuesta directa a tu pregunta: sí, al subir los escandallos los ingredientes se añaden solos.)

El mapeo de columnas se puede **guardar como plantilla**, así el segundo Excel del mismo formato se importa sin volver a configurar nada.

### 2. Ficha de escandallo estructurada (creación manual)
Cuando no haya Excel, crear una receta arrancará ya en una **ficha técnica estructurada** (no en el campo de texto libre actual):
- Datos generales y rendimiento
- Tabla de ingredientes, una línea por producto: cantidad, unidad, merma, coste, proveedor
- Coste total y coste por porción automáticos
- PVP y Food Cost
- Procedimiento por pasos, alérgenos y observaciones

> Nota: el motor de cálculo (coste, coste/ración, food cost, margen, PVP) **ya está construido y funcionando** en Marginbite; este entregable lo pone como punto de entrada de la creación manual y lo conecta con la importación, para que ambos caminos produzcan el mismo escandallo.

---

## Qué NO incluye (para acotar y no encarecer)

- **OCR de recetas en PDF o foto.** El importador es para Excel; la lectura de PDF/imagen es otra pieza que se puede valorar más adelante.
- **Formatos de compra** (saco/bolsa/tarro → unidad base con equivalencias). Es un módulo aparte ya identificado.
- **Cálculo automático de alérgenos** a partir de ingredientes: se importan/introducen como texto, no se deducen.
- **Escalado de producción avanzado** más allá de porciones/rendimiento.

Cualquiera de estos se puede añadir después como ampliación con su propia estimación.

---

## Qué necesito de ti para cerrarlo

- El **Excel de menú real de Connatura** que ibas a enviarme. Con el formato real fijo el alcance exacto y el mapeo de columnas, y evito cobrarte por casos que no vas a usar.
- Confirmar si los Excel traen **una receta por hoja** o **varias recetas en una misma hoja** (afecta al esfuerzo del parser).

---

## Estimación

| Entregable | Desarrollo |
|---|---|
| Lectura del Excel + normalización de filas | ~1 día |
| Mapeo de columnas + guardar plantilla | ~1 día |
| Motor de coincidencia de ingredientes + alta en borrador + conversiones | ~1,5 días |
| Pantalla de revisión editable (errores, confirmaciones) | ~2 días |
| Guardado transaccional (escandallo + líneas + ingredientes) | ~1 día |
| Ficha manual estructurada (entregable 2) | ~1 día |
| Pruebas con el Excel real + ajustes | ~1 día |
| **Total** | **~8,5 días laborables** |

**Plazo:** ~2 semanas desde que reciba el Excel de muestra.

**Precio orientativo:** 8–9 días × tu tarifa/día.
*(Ejemplo: a ~200–250 €/día saldría del orden de 1.700–2.250 €. Ajusta el número a tu tarifa — la estimación firme es la de días.)*

**Opción reducida** — si quiere arrancar ya con lo mínimo: solo la **ficha manual estructurada** (entregable 2), ~1,5–2 días, y dejamos el importador de Excel para una segunda fase.

---

*Alcance nuevo respecto al MVP entregado (Food Cost + control laboral), que queda cerrado y funcionando.*
