const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ook5b.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    await client.connect();
    const servicesCollection = client.db('doctor_portal').collection('services');
    const bookingCollection = client.db('doctor_portal').collection('bookings');

    app.get('/service', async(req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    app.get('/available', (req, res) => {
      
    })

    /**
     *  API Naming Convention
     * app.get('/booking') // get all booking in this collection, or get more than one or by filter
     * app.get('/booking/:id') // get one booking by id
     * app.post('/booking') // create new booking
     * app.put('/booking/:id') // update booking by id
     * app.delete('/booking/:id') // delete booking by id
     */

    app.post('/booking', async(req, res) => {
      const booking = req.body;
      const query = {treatment: booking.treatment, date: booking.date, patient: booking.patient};
      const exists = await bookingCollection.findOne(query);
      if(exists) {
        return res.send({success: false, booking: exists})
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({success: true, result});
    })



  }
  finally {

  }

}
run().catch(console.Console.dir);


app.get('/', (req, res) => {
  res.send('Hello From Doctor Uncle')
})

app.listen(port, () => {
  console.log(`Doctors App listening on port ${port}`)
})