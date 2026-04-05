const { MongoClient } = require('mongodb');

const SOURCE_CLUSTER_URI = "mongodb+srv://rupesh7208:Singh720846@cluster0.pcuuexc.mongodb.net/?appName=Cluster0";
const TARGET_CLUSTER_URI = "mongodb+srv://techrupeshsingh_db_user:GeZIfhYKEsE0hBVE@cluster0.otugur4.mongodb.net/?appName=Cluster0";

const DATABASES_TO_MIGRATE = [
  'SalesAdmin',
  'SalesAdmin_PROD',
  'SalesAdmin_QA',
  'employees',
  'test'
];

async function migrate() {
  const sourceClient = new MongoClient(SOURCE_CLUSTER_URI);
  const targetClient = new MongoClient(TARGET_CLUSTER_URI);

  try {
    console.log("Connecting to source and target clusters...");
    await sourceClient.connect();
    await targetClient.connect();

    console.log("Connected Successfully.");

    for (const dbName of DATABASES_TO_MIGRATE) {
      console.log(`\n========================================`);
      console.log(`>>> MIGRATING DATABASE: ${dbName}`);
      console.log(`========================================`);
      
      const sourceDb = sourceClient.db(dbName);
      const targetDb = targetClient.db(dbName);

      const collections = await sourceDb.listCollections().toArray();
      
      if (collections.length === 0) {
        console.log(`[ALERT] No collections found in ${dbName}`);
        continue;
      }

      console.log(`[INFO] Found ${collections.length} collections.`);

      for (const colInfo of collections) {
        const colName = colInfo.name;
        if (colName.startsWith('system.')) continue;

        const sourceCol = sourceDb.collection(colName);
        const count = await sourceCol.countDocuments();
        
        console.log(`[TRANS] ${colName}: Migrating ${count} docs...`);

        if (count > 0) {
          const documents = await sourceCol.find({}).toArray();
          const targetCol = targetDb.collection(colName);

          try {
            await targetCol.deleteMany({});
            const result = await targetCol.insertMany(documents);
            console.log(`[DONE] ${colName}: Inserted ${result.insertedCount} docs.`);
          } catch (e) {
            console.error(`[FAIL] ${colName} Error: ${e.message}`);
          }
        } else {
          console.log(`[SKIP] ${colName} is empty.`);
        }
      }
      console.log(`>>> FINISHED DATABASE: ${dbName}`);
    }

    console.log(`\n========================================`);
    console.log(`All requested databases migrated successfully!`);
    console.log(`========================================`);

  } catch (err) {
    console.error("\nMigration error:", err);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log("Connections closed.");
  }
}

migrate();
