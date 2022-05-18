const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// var nodemailer = require('nodemailer'); //email

// var transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_ADDRESS,
//     pass: process.env.EMAIL_PASSWORD
//   }
// });


// function sendAppointmentEmail(booking) {
//   const {patient, patientName, treatment, date, slot} = booking;

//   var mailOptions = {
//     from: process.env.EMAIL_ADDRESS,
//     to: {patient},
//     subject: `Your Appointment for ${treatment} in on ${date} at ${slot} is confirmed`,
//     text: `Your Appointment for ${treatment} in on ${date} at ${slot} is confirmed`,
//     html: `
//     <div>
//     <p>Hello ${patientName},</p>
//     <p>Your appointment for ${treatment} in on ${date} at ${slot} is confirmed.</p>
//     <p>Looking forward to seeing you on ${date}</p>

//     <p>Regards,</p>
//     <p>The Clinic</p>

//     </div>
//     `
//   };

//   transporter.sendMail(mailOptions, function(error, info){
//     if (error) {
//       console.log(error);
//     } else {
//       console.log('Email sent: ' + info.response);
//     }
//   });

// }



// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ook5b.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ error: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ error: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const servicesCollection = client.db("doctor_portal").collection("services");
    const bookingCollection = client.db("doctor_portal").collection("bookings");
    const userCollection = client.db("doctor_portal").collection("users");
    const doctorCollection = client.db("doctor_portal").collection("doctors");

    const verifyAdmin = async(req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === "admin") {
        next();
      }
      else {
        res.status(403).send({ error: "Forbidden Access"});

      }
    }

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query).project({name: 1});
      const services = await cursor.toArray();
      res.send(services);
    });

    app.get("/user", verifyJWT, async (req, res) => {
      const user = await userCollection.find().toArray();
      res.send(user);
    });

    app.get('/admin/:email', async(req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === "admin";
      res.send({admin: isAdmin});      
    })


    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;      
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);     
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date;

      // step 1: get all services
      const services = await servicesCollection.find().toArray();

      // step 2: get the booking of the day. output: [{},{},{},{},{},{},{},{},{}]
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service
      services.forEach((service) => {
        // step 4: find bookings for that service. output: [{},{},{},{}]
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        // step 5: select slots for the service Bookings ['','','','']
        const bookedSlots = serviceBookings.map((book) => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        // step 7: set available to slots to make it easier
        service.slots = available;
      });

      res.send(services);
    });

    /**
     *  API Naming Convention
     * app.get('/booking') // get all booking in this collection, or get more than one or by filter
     * app.get('/booking/:id') // get one booking by id
     * app.post('/booking') // create new booking
     * app.put('/booking/:id') // update booking by id
     * app.delete('/booking/:id') // delete booking by id
     */

    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ error: "Forbidden Access" });
      }
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);

      //email
      // console.log('sending email');
      // sendAppointmentEmail(booking);
      
      //

      return res.send({ success: true, result });

    });



    app.post('/doctor', verifyJWT, verifyAdmin, async(req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.get('/doctor', verifyJWT, verifyAdmin, async(req, res) => {      
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    })
    
    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async(req, res) => { 
      const email = req.params.email;
      const filter = {email: email};
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
    })

  } finally {
  }
}
run().catch(console.Console.dir);

app.get("/", (req, res) => {
  res.send("Hello From Doctor Uncle");
});

app.listen(port, () => {
  console.log(`Doctors App listening on port ${port}`);
});
