export default function Setup() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
      <div className="max-w-2xl w-full">
        <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-10 shadow-2xl" style={{ boxShadow: '0 0 35px rgba(159, 37, 184, 0.25)' }}>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <span className="text-5xl">⚙️</span>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#9f25b8] to-[#c66bff] bg-clip-text text-transparent font-['Poppins'] mb-3">
              Configuración de AutoClose AI
            </h1>
            <p className="text-white/70 text-lg">La aplicación requiere configuración adicional</p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6">
            <h2 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
              <span>⚠️</span> Error de Conexión MongoDB
            </h2>
            <p className="text-white/80 text-sm">
              El secreto <code className="bg-black/30 px-2 py-1 rounded">MONGO_URI</code> no está configurado correctamente.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">📝 Pasos para configurar:</h3>
              <ol className="list-decimal list-inside space-y-2 text-white/80 text-sm">
                <li>Abre el archivo <code className="bg-black/30 px-2 py-1 rounded">.env</code> en la raíz del proyecto</li>
                <li>Agrega o edita la variable <code className="bg-black/30 px-2 py-1 rounded">MONGO_URI</code></li>
                <li>Ingresa tu URL de MongoDB Atlas completa</li>
                <li>Ejemplo: <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs">MONGO_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/database</code></li>
                <li>Guarda el archivo y reinicia la aplicación</li>
              </ol>
            </div>

            <div className="bg-white/5 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">🔐 Variables de entorno requeridas:</h3>
              <ul className="space-y-2 text-white/80 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <div>
                    <strong className="text-white">MONGO_URI:</strong> URL de conexión a MongoDB Atlas (en <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs">.env</code> de la raíz)
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <div>
                    <strong className="text-white">JWT_SECRET:</strong> Clave secreta para tokens JWT (en <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs">.env</code> de la raíz)
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <div>
                    <strong className="text-white">OPENAI_API_KEY:</strong> Clave API de OpenAI (en <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs">.env</code> de la raíz)
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <h3 className="text-blue-400 font-semibold mb-2">💡 ¿No tienes MongoDB Atlas?</h3>
              <p className="text-white/70 text-sm mb-3">
                Crea una cuenta gratuita en <a href="https://www.mongodb.com/cloud/atlas" target="_blank" className="text-[#9f25b8] underline">MongoDB Atlas</a>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-white/70 text-xs">
                <li>Crea un cluster gratuito</li>
                <li>Configura un usuario de base de datos</li>
                <li>Permite el acceso desde cualquier IP (0.0.0.0/0)</li>
                <li>Copia la connection string</li>
              </ol>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white rounded-xl font-medium transition-opacity"
            >
              Reintentar Conexión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
