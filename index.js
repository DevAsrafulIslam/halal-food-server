require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5001;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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

let menuCollection, reviewsCollection, cartCollection;

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    const db = client.db("halalfoodDB");
    usersCollection = db.collection("users");
    menuCollection = db.collection("menu");
    reviewsCollection = db.collection("reviews");
    cartCollection = db.collection("carts");
    orderCollection = db.collection("orders");

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Start the Express server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

// payment gateway
app.post("/orders", async (req, res) => {
  const order = req.body;
  const result = await orderCollection.insertOne(order);
  res.send(result);
});

app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  res.send(token);
});
// Warning: we verifyJWT before using verify verifyAdmin
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  if (user?.role !== "admin") {
    return res.status(403).send({ error: true, message: "forbidden message" });
  }
  next();
};
/*
 * 0. do not show secure links to those who should not see the links
 * 1. use jwt token:verifyJWT
 * 2. use verifyAdmin middleware
 */
// users related apis
app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
  const result = await usersCollection.find().toArray();
  res.send(result);
});

app.post("/users", async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const existingUser = await usersCollection.findOne(query);
  if (existingUser) {
    return res.send({ message: "User already exists" });
  }
  const result = await usersCollection.insertOne(user);
  res.send(result);
});
// security layer: verifyJWT
// email same
// check admin
app.get("/users/admin/:email", verifyJWT, async (req, res) => {
  const email = req.params.email;

  if (req.decoded.email !== email) {
    res.send({ admin: false });
  }

  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const result = { admin: user?.role === "admin" };
  res.send(result);
});

app.patch("/users/admin/:id", async (req, res) => {
  const id = req.params.id;
  console.log(id);
  const filter = { _id: new ObjectId(id) };
  // update the role of the user to admin
  const updateDoc = {
    $set: {
      role: "admin",
    },
  };
  const result = await usersCollection.updateOne(filter, updateDoc);
  res.send(result);
});

app.delete("/users/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await usersCollection.deleteOne(query);
  console.log(result);
});

// menu related apis
app.get("/menu", async (req, res) => {
  try {
    const result = await menuCollection.find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).send("Error retrieving menu data");
    console.error(error);
  }
});

// review related apis
app.get("/reviews", async (req, res) => {
  try {
    const result = await reviewsCollection.find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).send("Error retrieving reviews data");
    console.error(error);
  }
});

// cart collection api
app.get("/carts", verifyJWT, async (req, res) => {
  const email = req.query.email;
  console.log(email);
  if (!email) {
    res.send([]);
  }
  const decodedEmail = req.decoded.email;
  if (email !== decodedEmail) {
    return res.status(403).send({ error: true, message: "forbidden access" });
  }

  const query = { email: email };
  const result = await cartCollection.find(query).toArray();
  res.send(result);
});

app.post("/carts", async (req, res) => {
  const item = req.body;
  console.log(item);
  const result = await cartCollection.insertOne(item);
  res.send(result);
});

app.delete("/carts/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await cartCollection.deleteOne(query);
  res.send(result);
});

app.get("/", (req, res) => {
  res.send("halal food in sitting");
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
