# Guía para trabajar en el repositorio (dos desarrolladores)

Objetivo: evitar trabajar sobre versiones viejas, duplicar cambios o pisar el trabajo del otro.

## Antes de empezar a trabajar (cada día o cada tarea)

1. Traer los últimos cambios del remoto:
   ```bash
   git pull --rebase origin main
   ```
2. Si usan ramas por tarea: crear o actualizar la rama desde `main` actualizada.

## Durante el trabajo

- **Commits:** Hacer commits pequeños y frecuentes (por cambio lógico), con mensajes claros.
- **Archivos:** Evitar tocar los mismos archivos a la vez en lo posible. Si ambos deben modificar algo, coordinar (ej. por chat) o repartir por carpetas/features.
- **Subir cambios:** Hacer commit y push con frecuencia para no acumular mucho trabajo solo en local.

## Antes de subir cambios (push)

1. Volver a actualizar con el remoto para no hacer push sobre una base vieja:
   ```bash
   git pull --rebase origin main
   ```
2. Si hay conflictos, resolverlos localmente.
3. Luego:
   ```bash
   git push origin main
   ```

Si usas el hook pre-push (recomendado), el paso 1 se hace automáticamente antes de cada push.

## Uso de ramas (opcional)

Si usan ramas por tarea:

- Crear ramas cortas: `feature/nombre-breve` o `fix/descripcion`.
- Integrar a `main` cuando la tarea esté lista (merge o pull request).
- Borrar la rama después de integrar y seguir trabajando desde `main` actualizado.

Pueden empezar solo con "siempre en main + pull antes de empezar y antes de push" y añadir ramas más adelante si lo necesitan.

---

## Configuración del hook pre-push (recomendado)

El hook obliga a actualizar con el remoto antes de cada push, evitando subir cambios sobre una versión antigua.

**Instalación (cada desarrollador, una vez):**

1. Copiar el script al directorio de hooks de Git:
   ```bash
   cp scripts/pre-push-hook.sh .git/hooks/pre-push
   ```
2. Darle permisos de ejecución:
   ```bash
   chmod +x .git/hooks/pre-push
   ```

A partir de ahí, cada vez que ejecutes `git push`, el hook hará `git fetch origin` y `git pull --rebase origin <rama-actual>`. Si hay conflictos, el push se abortará y tendrás que resolverlos y volver a intentar.

**Nota:** Si clonas de nuevo el repo, debes repetir estos dos pasos (los hooks no se versionan).
