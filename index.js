const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
// const jwt = require('jsonwebtoken');

require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.port || 5000;

// middleware
app.use(cors());
app.use(express.json());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t03zmwp.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://bookship_admin:Ak3z5tDNm3OlXw8G@cluster0.zbzm9lw.mongodb.net/?retryWrites=true&w=majority`;

console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// console.log(uri)

// jwt verify
const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("Unauthorized request");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send("Unauthorized request");
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // await client.connect();
    const categoryCollection = client.db("bookship").collection("categories");
    const userCollection = client.db("bookship").collection("user");
    const bookCollection = client.db("bookship").collection("books");
    const orderCollection = client.db("bookship").collection("order");
    const reviewsCollection = client.db("bookship").collection("reviews");

    app.post("/create-payment-intent", async (req, res) => {
      const order = req.body;
      const price = parseInt(order.price);
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
      res.send({ token });
      console.log(user);
    });

    // get all categories from category collection
    app.get("/categories", async (req, res) => {
      const cursor = categoryCollection.find({});
      const categories = await cursor.toArray();
      // console.log(categories)
      res.send(categories);
    });

    // Save user data in database
    app.post("/saveuser", async (req, res) => {
      const user = req.body;
      const email = { email: user.email };
      const exsistUser = await userCollection.findOne(email);
      if (exsistUser) {
        res.send({ message: "user exesting" });
        return;
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.post("/categories", async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.json(result);
    });

    //delete categories based on id
    app.delete("/categories/:id", async (req, res) => {
      const id = req.params.id;
      const result = await categoryCollection.deleteOne({ _id: ObjectId(id) });
      res.json(result);
    });

    // upsert user information to user collection
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await userCollection.updateOne(
        { email: user.email },
        { $set: user },
        { upsert: false }
      );
      res.json(result);
    });

    // get user role from userCollection based on email query
    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const user = await userCollection.findOne({
        email: email,
      });
      // console.log(user);
      res.send(user);
    });

    // patch user to update user role and email on social login
    app.patch("/user", async (req, res) => {
      const user = req.body;
      const result = await userCollection.updateOne(
        { email: user.email },
        { $set: user },
        { upsert: true }
      );
      res.json(result);
    });

    // post new book to book collection
    app.post("/book", async (req, res) => {
      const book = req.body;
      const result = await bookCollection.insertOne(book);
      // console.log(result)
      res.json(result);
    });

    // get book by id
    app.get("/book/:id", async (req, res) => {
      const id = req.params.id;
      const book = await bookCollection.findOne({ _id: ObjectId(id) });
      res.send(book);
    });

    // get all books from book collection
    app.get("/books", async (req, res) => {
      const cursor = bookCollection.find({});
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books);
    });

    // get all the books which have isAdvertised = "yes"
    app.get("/advertisedBooks", async (req, res) => {
      const cursor = bookCollection.find({ isAdvertise: "yes" });
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books.reverse());
    });

    // get lastly added 3 books from book collection
    app.get("/recents", async (req, res) => {
      const cursor = bookCollection.find({}).sort({ _id: -1 }).limit(3);
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books);
    });

    // get the category title based on id params
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const category = await categoryCollection.findOne({
        _id: ObjectId(id),
      });
      res.send(category);
    });

    // need jwt

    // filter books by seller email and skip the books which have the same email as the query
    app.get("/booksbyseller", async (req, res) => {
      const email = req.query.email;
      const cursor = bookCollection.find({ selleremail: { $ne: email } });
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books);
    });

    // need jwt

    // get books for a specific seller by seller email
    app.get("/booksforseller", async (req, res) => {
      // const decoded = req.decoded;
      // console.log('books for seller', decoded);

      // if (decoded.email !== req.query.email) {
      //   return res.status(401).send('Unauthorized request');
      // }

      console.log(req.headers.authorization);
      const email = req.query.email;
      const cursor = bookCollection.find({ selleremail: email });
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books);
    });

    // update book status based on id params using patch method
    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id;
      const book = req.body;
      const result = await bookCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: book },
        { upsert: true }
      );
      res.json(result);
    });

    // add reported: true to book collection based on id params
    app.patch("/report/:id", async (req, res) => {
      const id = req.params.id;
      const book = req.body;
      const result = await bookCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: book },
        { upsert: true }
      );
      res.json(result);
    });

    // delete book based on id params
    app.delete("/books/:id", async (req, res) => {
      const id = req.params.id;
      const result = await bookCollection.deleteOne({ _id: ObjectId(id) });
      res.json(result);
    });

    // update isAdvertise status based on id params using patch method
    app.patch("/advertise/:id", async (req, res) => {
      const id = req.params.id;
      const book = req.body;
      const result = await bookCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: book },
        { upsert: true }
      );
      res.json(result);
    });

    // update price based on id params using patch method
    app.patch("/updateprice/:id", async (req, res) => {
      const id = req.params.id;
      const book = req.body;
      const result = await bookCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: book },
        { upsert: true }
      );
      res.json(result);
    });

    // post order data to database
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      // console.log(result)
      res.json(result);
    });

    // need jwt

    // get orders based on email query and match the email with selleremail
    app.get("/orders", async (req, res) => {
      // const decoded = req.decoded;
      // console.log('books for seller', decoded);

      // if (decoded.email !== req.query.email) {
      //   return res.status(401).send('Unauthorized request');
      // }
      const email = req.query.email;
      const cursor = orderCollection.find({ selleremail: email });
      const orders = await cursor.toArray();
      // console.log(orders)
      res.send(orders);
    });

    // need jwt
    // get orders based on email query and match the email with buyeremail
    app.get("/buyerorders", async (req, res) => {
      // const decoded = req.decoded;
      // console.log('books for seller', decoded);

      // if (decoded.email !== req.query.email) {
      //   return res.status(401).send('Unauthorized request');
      // }

      const email = req.query.email;
      const cursor = orderCollection.find({ email: email });
      const orders = await cursor.toArray();
      // console.log(orders)
      res.send(orders);
    });

    // get orders by id
    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;
      const order = await orderCollection.findOne({
        _id: ObjectId(id),
      });
      res.send(order);
    });

    // update order isPaid status based on id params using patch method
    app.patch("/order/:id", async (req, res) => {
      const id = req.params.id;
      const order = req.body;
      const result = await orderCollection.updateOne(
        {
          _id: ObjectId(id),
        },
        {
          $set: order,
        },
        {
          upsert: true,
        }
      );
      res.json(result);
    });

    // get all the users
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find({});
      const users = await cursor.toArray();
      // console.log(users)
      res.send(users);
    });

    // delete user by email query
    app.delete("/users", async (req, res) => {
      const email = req.query.email;
      const result = await userCollection.deleteOne({ email: email });
      res.json(result);
    });

    // update user role by email query
    app.patch("/users", async (req, res) => {
      const email = req.query.email;
      const user = req.body;
      const result = await userCollection.updateOne(
        { email: email },
        { $set: user },
        { upsert: true }
      );
      res.json(result);
    });

    // verify seller by email query
    app.patch("/verify", async (req, res) => {
      const email = req.query.email;
      const user = req.body;
      const result = await userCollection.updateOne(
        { email: email },
        { $set: user },
        { upsert: true }
      );
      res.json(result);
    });

    // push reviews to database
    app.post("/addreview", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      review.id = result.insertedId;
      console.log(
        `New review created with the following id: ${result.insertedId}`
      );
    });

    // get all reviews
    // app.get('/reviews', async (req, res) => {
    //     const query = {}
    //     const cursor = reviewsCollection.find(query);
    //     const reviews = await cursor.toArray();
    //     res.send(reviews);
    // });

    // get reviews from database based on service id
    app.get("/reviews/:id", async (req, res) => {
      const query = { bookId: req.params.id };
      const cursor = reviewsCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    // delete a review
    app.delete("/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      console.log(`Deleted ${result.deletedCount} item.`);
      res.send(result);
    });

    // get reviews based on reviewerEmail
    app.get("/reviews", async (req, res) => {
      // console.log(req.headers.authorization)
      const decoded = req.user;
      console.log(decoded);
      const query = { reviewerEmail: req.query.email };
      const cursor = reviewsCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    //update a review
    // app.patch('/reviews/:id', async (req, res) => {
    //   const query = { bookId: req.params.id };
    //   const update = { $set: req.body };
    //   const options = { returnOriginal: false };
    //   const result = await reviewsCollection.findOneAndUpdate(
    //     query,
    //     update,
    //     options
    //   );
    //   res.send(result);
    // });

    // update review
    app.put("/reviews/edit/:id", async (req, res) => {
      const id = req.params.id;
      const comment = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedComment = {
        $set: {
          comment: comment.comment,
          commentDate: comment.commentDate,
        },
      };
      const result = await reviewsCollection.updateOne(
        filter,
        updatedComment,
        options
      );
      res.send(result);
    });

    // get specific categories and publications
    app.get("/specific-categories", async (req, res) => {
      const query = {};
      const projection = {
        category: 1,
        publication: 1,
        authorName: 1,
        authorEmail: 1,
      };
      const result = await bookCollection
        .find(query)
        .project(projection)
        .toArray();
      res.send(result);
    });


  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Bookship server running nonstop");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
