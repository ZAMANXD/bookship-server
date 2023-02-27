const express = require('express');
// const jwt = require('jsonwebtoken');

require('dotenv').config();
const cors = require('cors');
const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.port || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zbzm9lw.mongodb.net/?retryWrites=true&w=majority`;

// console.log(uri);

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// In-memory data store for cart items
const cartItems = [];

// // SendGrid config
// const sgMail = require('@sendgrid/mail');
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function sendOrderEmail(order) {
  const { email } = order;
  const mailgunAuth = {
    auth: {
      api_key: process.env.MAIL_GUN_API_KEY,
      domain: process.env.MAIL_GUN_DOMAIN,
    },
  };

  const smtpTransport = nodemailer.createTransport(mg(mailgunAuth));

  const mailOptions = {
    from: 'morshed952640@gmail.com', // verified sender email
    to: email, // recipient email
    subject: 'Purchase confirmation', // Subject line
    text: 'Hello world!', // plain text body
    html: `
    <h3 style="font-size: 24px;">Your Payment was Successful!</h3>
    <p style="font-size: 18px;">Thank you for shopping with BookShip. We are processing your order. One of our agent will ship your ordered items to your address within the next 03 Days. Happy Shipping!.</p>
    `, // html body
  };

  smtpTransport.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log('Email send error', error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}
// console.log(uri)

// jwt verify
const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('Unauthorized request');
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send('Unauthorized request');
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // await client.connect();
    const categoryCollection = client.db('bookship').collection('categories');
    const userCollection = client.db('bookship').collection('user');
    const bookCollection = client.db('bookship').collection('books');
    const orderCollection = client.db('bookship').collection('order');
    const reviewsCollection = client.db('bookship').collection('reviews');
    const publicationCollection = client
      .db('bookship')
      .collection('publications');
    const subscriberCollection = client.db('bookship').collection('subscriber');
    const favoruriteCollection = client.db('bookship').collection('favorurite');
    const cartCollection = client.db('bookship').collection('cart');
    const blogCollection = client.db('bookship').collection('blogs');

    app.post('/create-payment-intent', async (req, res) => {
      const order = req.body;
      const price = parseInt(order.price);
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
      res.send({ token });
      console.log(user);
    });

    app.post('/subscribe', async (req, res) => {
      const email = req.body.email;

      try {
        const result = await subscriberCollection.insertOne({ email: email });
        console.log(result);
        //send confirmation email
        sendOrderEmail();
        res.status(200).send({ message: 'Subscription successful!' });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Something went wrong' });
      }
    });

    // get all categories from category collection
    app.get('/categories', async (req, res) => {
      const cursor = categoryCollection.find({});
      const categories = await cursor.toArray();
      // console.log(categories)
      res.send(categories);
    });

    // Save user data in database
    app.post('/saveuser', async (req, res) => {
      const user = req.body;
      const email = { email: user.email };
      const exsistUser = await userCollection.findOne(email);
      if (exsistUser) {
        res.send({ message: 'user exesting' });
        return;
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // admin check in db
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send({ isAdmin: user?.role === 'admin' });
    });

    // seller check in db
    app.get('/users/seller/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send({
        isSeller: user?.role === 'seller',
      });
    });

    // //category update
    // app.put('/categories', async (req, res) => {
    //   const category = req.body;
    //   const filter = { category: category };
    //   const options = { upsert: true };
    //   const updateDoc = {
    //     $set: {
    //       category,
    //     },
    //   };
    //   const result = await categoryCollection.updateOne(
    //     filter,
    //     updateDoc,
    //     options
    //   );
    //   res.send(result);
    // });

    //delete categories based on id
    app.delete('/categories/:id', async (req, res) => {
      const id = req.params.id;
      const result = await categoryCollection.deleteOne({ _id: ObjectId(id) });
      res.json(result);
    });

    // upsert user information to user collection
    app.post('/user', async (req, res) => {
      const user = req.body;
      const result = await userCollection.updateOne(
        { email: user.email },
        { $set: user },
        { upsert: false }
      );
      res.json(result);
    });

    // get user role from userCollection based on email query
    app.get('/user', async (req, res) => {
      const email = req.query.email;
      const user = await userCollection.findOne({
        email: email,
      });
      // console.log(user);
      res.send(user);
    });

    // patch user to update user role and email on social login
    app.patch('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const updateDoc = {
        $set: {
          name: user.name,
          phone: user.phone,
          role: user.role,
          address: user.address,
        },
      };
      console.log(user, query);
      const result = await userCollection.updateOne(query, updateDoc);
      res.json(result);
    });

    // post new book to book collection
    app.post('/book', async (req, res) => {
      const book = req.body;
      const result = await bookCollection.insertOne(book);
      // console.log(result)
      res.json(result);
    });

    // get book by id
    app.get('/book/:id', async (req, res) => {
      const id = req.params.id;
      const book = await bookCollection.findOne({ _id: ObjectId(id) });
      res.send(book);
    });

    // get all books from book collection
    app.get('/books', async (req, res) => {
      const cursor = bookCollection.find({});
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books);
    });

    // get all the books which have isAdvertised = "yes"
    app.get('/advertisedBooks', async (req, res) => {
      const cursor = bookCollection.find({ isAdvertise: 'yes' });
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books.reverse());
    });

    // get lastly added 3 books from book collection
    app.get('/recents', async (req, res) => {
      const cursor = bookCollection.find({}).sort({ _id: -1 }).limit(3);
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books);
    });

    // get the category title based on id params
    app.get('/category/:id', async (req, res) => {
      const id = req.params.id;
      const category = await categoryCollection.findOne({
        _id: ObjectId(id),
      });
      res.send(category);
    });

    // need jwt

    // filter books by seller email and skip the books which have the same email as the query
    app.get('/booksbyseller', async (req, res) => {
      const email = req.query.email;
      const cursor = bookCollection.find({ selleremail: { $ne: email } });
      const books = await cursor.toArray();
      // console.log(books)
      res.send(books);
    });

    // need jwt

    // get books for a specific seller by seller email
    app.get('/booksforseller', async (req, res) => {
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
    app.patch('/books/:id', async (req, res) => {
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
    app.patch('/report/:id', async (req, res) => {
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
    app.delete('/books/:id', async (req, res) => {
      const id = req.params.id;
      const result = await bookCollection.deleteOne({ _id: ObjectId(id) });
      res.json(result);
    });

    // update isAdvertise status based on id params using patch method
    app.patch('/advertise/:id', async (req, res) => {
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
    app.patch('/updateprice/:id', async (req, res) => {
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
    app.post('/order', async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      //send confirmation email
      sendOrderEmail(order);
      // console.log(order);
      res.json(result);
    });

    // need jwt

    // get orders based on email query and match the email with selleremail
    app.get('/orders', async (req, res) => {
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
    app.get('/buyerorders', async (req, res) => {
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
    app.get('/order/:id', async (req, res) => {
      const id = req.params.id;
      const order = await orderCollection.findOne({
        _id: ObjectId(id),
      });
      res.send(order);
    });

    // update order isPaid status based on id params using patch method
    app.patch('/order/:id', async (req, res) => {
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
    app.get('/users', async (req, res) => {
      const cursor = userCollection.find({});
      const users = await cursor.toArray();
      // console.log(users)
      res.send(users);
    });

    // delete user by email query
    app.delete('/users', async (req, res) => {
      const email = req.query.email;
      const result = await userCollection.deleteOne({ email: email });
      res.json(result);
    });

    // update user role by email query
    app.patch('/users', async (req, res) => {
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
    app.patch('/verify', async (req, res) => {
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
    app.post('/addreview', async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      review.id = result.insertedId;
      console.log(
        `New review created with the following id: ${result.insertedId}`
      );
      res.send(result);
    });

    // get reviews from database based on service id
    app.get('/reviews/:id', async (req, res) => {
      const query = { bookId: req.params.id };
      const cursor = reviewsCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    // delete a review
    app.delete('/delete/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      console.log(`Deleted ${result.deletedCount} item.`);
      res.send(result);
    });

    // get reviews based on reviewerEmail
    app.get('/reviews', async (req, res) => {
      // console.log(req.headers.authorization)
      const decoded = req.user;
      console.log(decoded);
      const query = { reviewerEmail: req.query.email };
      const cursor = reviewsCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    // update review
    app.put('/reviews/edit/:id', async (req, res) => {
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
    app.get('/specific-categories', async (req, res) => {
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

    // get books by author email
    app.get('/book', async (req, res) => {
      const email = req.query.email;
      const query = { authorEmail: email };
      const books = await bookCollection.find(query).toArray();
      res.send(books);
    });

    // get books by author in author page.
    app.get('/author/:name', async (req, res) => {
      const name = req.params.name;
      const query = { authorName: name };
      const books = await bookCollection.find(query).toArray();
      res.send(books);
    });

    // get books by category in category page.
    app.get('/categories/:name', async (req, res) => {
      const name = req.params.name;
      const query = { category: name };
      const books = await bookCollection.find(query).toArray();
      res.send(books);
    });

    // get books by publication in publication page
    app.get('/publications/:name', async (req, res) => {
      const name = req.params.name;
      const query = { publication: name };
      const books = await bookCollection.find(query).toArray();
      res.send(books);
    });

    // get all categories
    app.get('/categories', async (req, res) => {
      const query = {};
      const categories = await categoryCollection.find(query).toArray();
      res.send(categories);
    });

    // get all publications
    app.get('/publications', async (req, res) => {
      const query = {};
      const publications = await publicationCollection.find(query).toArray();
      res.send(publications);
    });

    // books (low to high)
    app.get('/booksprice', async (req, res) => {
      const value = req.query.value;
      const query = {};
      const result = await bookCollection
        .find(query)
        .sort({ discountedPrice: value })
        .toArray();
      res.send(result);
    });

    // Add to favoruite
    app.put('/favorurite', async (req, res) => {
      const favorurite = req.body;
      const query = { productId: favorurite.productId };
      // console.log(favorurite);
      // console.log(query);
      const exesting = await favoruriteCollection.findOne(query);
      if (exesting) {
        res.send({ message: 'This is already existing' });
      } else {
        const result = await favoruriteCollection.insertOne(favorurite);
        res.send(result);
      }
    });

    // add to cart
    app.post('/add-to-cart', async (req, res) => {
      const { id, quantity, userEmail } = req.body;
      let cart;
      cart = await cartCollection.findOne({ userEmail });
      if (!cart) {
        await cartCollection.insertOne({
          userEmail,
          items: [{ id, quantity }],
        });
      } else {
        const existingItem = cart.items.find((item) => item.id === id);

        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          cart.items.push({ id, quantity });
        }
        await cartCollection.updateOne(
          { _id: cart._id },
          { $set: { items: cart.items } }
        );
      }
      res.sendStatus(200);
    });

    // subtract from cart
    app.put('/subtract-from-cart', async (req, res) => {
      const { id, quantity, userEmail } = req.body;
      let cart;
      cart = await cartCollection.findOne({ userEmail });

      if (!cart) {
        res.sendStatus(404);
      } else {
        const existingItem = cart.items.find((item) => item.id === id);

        if (existingItem) {
          existingItem.quantity -= quantity;

          if (existingItem.quantity <= 0) {
            cart.items = cart.items.filter((item) => item.id !== id);
          }

          await cartCollection.updateOne(
            { _id: cart._id },
            { $set: { items: cart.items } }
          );

          res.sendStatus(200);
        } else {
          res.sendStatus(404);
        }
      }
    });

    // remove from cart
    app.delete('/remove-from-cart/:id/:userEmail', async (req, res) => {
      const { id, userEmail } = req.params;
      let cart;
      cart = await cartCollection.findOne({ userEmail });
      if (!cart) {
        res.sendStatus(404);
      } else {
        cart.items = cart.items.filter((item) => item.id !== parseInt(id));

        await cartCollection.updateOne(
          { _id: cart._id },
          { $set: { items: cart.items } }
        );

        res.sendStatus(200);
      }
    });

    //get cart items
    app.get('/cart/:email', async (req, res) => {
      const userEmail = req.params;
      const cart = await cartCollection.findOne({ userEmail });
      res.send(cart);
    });

    // blog
    app.get('/blogs', async (req, res) => {
      const query = {};
      const result = await blogCollection.find(query).toArray();
      res.send(result);
    });
    // blog by id
    app.get('/blogs/:id', async (req, res) => {
      const id = req.params.id;
      const blog = await blogCollection.findOne({ _id: ObjectId(id) });
      res.send(blog);
    });

    // get fuction for 
    app.get("/favorite/:email",async(req,res)=>{
      const email = req.params.email
      const query = {userEmail:email}
      const allproduct = await favoruriteCollection.find(query).toArray();
      res.send(allproduct)
    })
  } finally {
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Bookship server running nonstop');
});

app.listen(port, () => {
  console.log(`The server listening on port: ${port}`);
});
