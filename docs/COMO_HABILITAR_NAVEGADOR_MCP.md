# Cómo dar acceso al navegador al agente de Cursor

Para que el agente pueda ejecutar la **prueba piloto** en el navegador (navegar, hacer login, rellenar formularios, etc.), hay que habilitar un servidor MCP de navegador.

## Opción 1: Desde la interfaz de Cursor (recomendado)

1. Abre **Cursor**.
2. Ve a **Settings** (⌘+, en Mac o Ctrl+, en Windows/Linux).
3. Busca **MCP** o entra en la pestaña **Tools** / **Herramientas**.
4. En **MCP Servers**, haz clic en **Add new** / **New MCP server**.
5. Si aparece **Browser** o **cursor-ide-browser**, añádelo y guarda.
6. Pulsa el botón de **recargar** (refresh) para que el agente vea las nuevas herramientas.

Tras esto, el agente debería tener herramientas como `browser_navigate`, `browser_tabs`, `browser_snapshot`, etc.

**Nota:** En algunas versiones de Cursor el servidor aparece como **cursor-ide-browser**. Si al usar el agente no ves herramientas de navegador, en **Settings → MCP** revisa que el servidor de Browser esté activo y que hayas recargado.

## Opción 2: Archivo de configuración MCP (por proyecto)

Si en tu versión de Cursor el navegador se configura por JSON:

1. Crea o edita el archivo **`.cursor/mcp.json`** en la raíz del proyecto.
2. Añade un servidor MCP de navegador. Por ejemplo, con **Browser MCP**:

```json
{
  "mcpServers": {
    "browser": {
      "command": "npx",
      "args": ["-y", "@browsermcp/mcp@latest"]
    }
  }
}
```

3. Guarda el archivo y **reinicia Cursor** (o recarga la ventana).
4. Vuelve a abrir el **Composer / Agente** y comprueba que las herramientas del navegador estén disponibles.

## Opción 3: Configuración global de Cursor

Para tener el navegador en todos tus proyectos:

- **macOS**: `~/.cursor/mcp.json`
- **Windows**: `%USERPROFILE%\.cursor\mcp.json`
- **Linux**: `~/.cursor/mcp.json`

Usa la misma estructura `mcpServers` que en la opción 2.

## Comprobar que funciona

1. Abre el **Composer** (modo Agente).
2. Pide al agente: *“Abre http://localhost:3000 en el navegador y dime qué título tiene la página”*.
3. Si el agente puede abrir la URL y leer el contenido, el MCP del navegador está activo.

## Requisitos

- **Node.js** instalado (v16 o superior) para usar `npx`.
- **Aplicación en marcha**: `npm run dev` en este proyecto y MongoDB conectado, para que la prueba piloto pueda ejecutarse de punta a punta.

## Prueba piloto

Con el navegador MCP habilitado, puedes pedir al agente:

- *“Inicia la prueba piloto del MVP según docs/MVP_VALIDACION_PILOTO.md”*

El agente usará el navegador para seguir el checklist y podrá generar el informe de validación.
