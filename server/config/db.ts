import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 
  "mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosecluster.srcqfmb.mongodb.net/autoclose_ai?retryWrites=true&w=majority";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB conectado exitosamente a AutoClose AI');
  } catch (error: any) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}

export { mongoose };
