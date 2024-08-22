require("dotenv").config();
const express = require("express");
const SSLCommerzPayment = require("sslcommerz-lts");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

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

// SSLComarz Payment Gateway
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWD;
const is_live = false; //true for live, false for sandbox

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
  const product = await cartCollection.findOne({
    _id: new ObjectId(req.body.productId),
  });
  console.log(product, "Product");

  const { cart, total, currency } = req.body;
  const productNames = cart.map((item) => item.name).join(", ");

  function generateTransactionId() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let transactionId = "";
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      transactionId += characters[randomIndex];
    }
    return transactionId;
  }

  const trans_id = generateTransactionId();

  const data = {
    total_amount: total,
    currency: currency,
    tran_id: trans_id,
    success_url: `http://localhost:5000/payment/success/${trans_id}`, // Corrected "sucess" to "success"
    fail_url: `http://localhost:5000/fail/${trans_id}`,
    cancel_url: "http://localhost:3030/cancel",
    ipn_url: "http://localhost:3030/ipn",
    shipping_method: "Courier",
    product_name: productNames,
    product_category: "Electronic",
    product_profile: "general",
    cus_name: "Customer Name",
    cus_email: "Email",
    cus_add1: "address",
    cus_add2: "Dhaka",
    cus_city: "Dhaka",
    cus_state: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: "01711111111",
    cus_fax: "01711111111",
    ship_name: "Customer Name",
    ship_add1: "Dhaka",
    ship_add2: "Dhaka",
    ship_city: "Dhaka",
    ship_state: "Dhaka",
    ship_postcode: 1000,
    ship_country: "Bangladesh",
  };

  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  sslcz.init(data).then(async (apiResponse) => {
    let GatewayPageURL = apiResponse.GatewayPageURL;
    // Respond with the GatewayPageURL to the frontend
    res.json({ GatewayPageURL });
    console.log("Redirecting to: ", GatewayPageURL);

    const finalOrder = {
      cart,
      total,
      currency,
      paidStatus: false, // Payment has not been made yet
      transactionId: trans_id,
    };
    const result = await orderCollection.insertOne(finalOrder);
    // console.log(result, "resulut");
  });
  app.post("/payment/success/:tranId", async (req, res) => {
    console.log(req.params.tranId);
    const transactionId = req.params.tranId;
    const result = await orderCollection.updateOne(
      { transactionId: req.params.tranId },
      { $set: { paidStatus: true } } // Update paid status to true
    );
    if (result.modifiedCount > 0) {
      res.redirect(`http://localhost:5173/payment/success/${transactionId}`);
    } else {
      res.status(400).json({ error: "Payment confirmation failed" });
    }
  });

  // payment failed

  app.post("/payment/fail/:tranId", async (req, res) => {
    const result = await orderCollection.deleteOne({
      transactionId: req.params.tranId,
    });
    if (result.deleteCount > 0) {
      res.redirect(`http://localhost:5173/payment/fail/${req.params.tranId}`);
    }
  });
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

// app.delete("/users/:id", async (req, res) => {
//   const id = req.params.id;
//   const query = { _id: new ObjectId(id) };
//   const result = await usersCollection.deleteOne(query);
//   console.log(result);
// });

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
