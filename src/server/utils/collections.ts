export async function ensureCollection(plugin: any, name: string) {
  if (!plugin.collectionSyncs.has(name)) {
    const sync = (async () => {
      const collection = plugin.db.getCollection(name);

      if (!collection) {
        return false;
      }

      await collection.model.sync({
        force: false,
        alter: {
          drop: false,
        },
      });

      return true;
    })().catch((error) => {
      plugin.collectionSyncs.delete(name);
      throw error;
    });

    plugin.collectionSyncs.set(name, sync);
  }

  return plugin.collectionSyncs.get(name);
}

export async function collectionExists(db: any, name: string, options?: any) {
  const collection = db.getCollection(name);
  return collection ? collection.existsInDb(options) : false;
}
