require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// database connection

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.p56ror2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db("halalfoodDB").collection("menu");
    const reviewsCollection = client.db("halalfoodDB").collection("reviews");
    const cardCollection = client.db("halalfoodDB").collection("cards");
    app.get("/menu", async (req, res) => {
      await client.connect();
      const result = await menuCollection.find().toArray();
      res.status(200).json(result);
      await client.close();
      console.log(result);
    });
    
    app.get("/reviews", async (req, res) => {
      await client.connect();
      const result = await reviewsCollection.find().toArray();
      res.status(200).json(result);
      await client.close();
      console.log(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("halal food in sitting");
});
app.listen(port, () => {
  console.log("halal food in sitting");
});

/**
 * ----------------------------
NAMING CONVERSION
-------------------------------
users:userCollection
app.get('/users')
app.get('/user/:id')
app.post('/users')
app.patch('/users/:id')
app.put('/users')
app.delete('/users/:id')
**/
