import mongoose from "mongoose";

type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: ConnectionCache | undefined;
}

const globalCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = globalCache;
}

export async function connectToDatabase() {
  if (globalCache.conn) {
    return globalCache.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Add it to .env.local before using memory features.",
    );
  }

  if (!globalCache.promise) {
    globalCache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
      })
      .then((mongooseInstance) => mongooseInstance);
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}
