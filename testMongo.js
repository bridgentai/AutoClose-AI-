// testMongo.js
// Test de conexión a MongoDB Atlas usando SRV en Node 24 (Windows)
// Forzamos IPv4 para evitar problemas de resolución

import { MongoClient } from "mongodb";

// Tu URI de MongoDB Atlas
const uri = "mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosecluster.srcqfmb.mongodb.net/autoclose_ai?retryWrites=true&w=majority";

// Opciones para Node 24 en Windows y clusters SRV
const options = {
  serverSelectionTimeoutMS: 5000, // tiempo máximo para encontrar servidor
  appName: "AutoCloseAI-Test",
};

async function test() {
  try {
    // Forzamos Node a usar IPv4 primero
    process.env.NODE_OPTIONS = "--dns-result-order=ipv4first";

    const client = new MongoClient(uri, options);
    await client.connect();
    console.log("✅ Conectado a MongoDB Atlas!");
    
    // Listamos las bases de datos como prueba
    const databases = await client.db().admin().listDatabases();
    console.log("Databases disponibles:", databases.databases.map(db => db.name));

    await client.close();
    console.log("🔒 Conexión cerrada correctamente.");
  } catch (err) {
    console.error("❌ Error al conectar a MongoDB Atlas:");
    console.error(err);
  }
}

test();