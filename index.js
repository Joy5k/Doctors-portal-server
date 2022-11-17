const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');


app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ctmwtm0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const appointmentOptionCollection = client.db('doctorsPortal').collection('appointmentOptions')
       const bookingsCollection=client.db('doctorsPortal').collection('bookings')
       const usersCollection=client.db('doctorsPortal').collection('users')
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const query = {}
            const options = await appointmentOptionCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookedSlot = optionBooked.map(book => book.slot);
               const remainingSlots=option.slots.filter(slot=> !bookedSlot.includes(slot))
                
                option.slots = remainingSlots;
          })
            res.send(options)
        });

        // optional or advance

        app.get('/v2/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const options = await appointmentOptionCollection.aggregate([
                {
                    $lookup:
                    {
                      from:'bookings',
                      localField:'name',
                        foreignField: 'treatment',
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq:['$appointmentDate',date]
                                    }
                                }
                            }
                        ],
                      as:'booked'
                    }
                },
                {
                    $project: {
                        name: 1,
                        slot: 1,
                        booked: {
                            $map:{
                                input: 'booked',
                                as: 'booked',
                                in:'$$booked.slot'
                            }
                        }
                    }
                },
                {
                    $project: {
                        name: 1,
                        slot: {
                            $setDifference:['$slots','$booked']
                        }
                        
                    }
                }
            ]).toArray()
            res.send(options)
        })

        app.get('/bookings', async(req,res)=> {
            const email = req.query.email;
            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings)
})

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                email:booking.email,
                treatment:booking.treatment
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if (alreadyBooked.length)
            {
                const message=`You already hava a booking on${booking.appointmentDate} `
               return res.send({acknowledged:false,message})
            }
            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

    }
    finally {
        
}


}run().catch(error=>console.log(error))

app.get('/', (req, res) => {
    res.send('doctors portal server is running')
})


app.listen(port, () => {
    console.log(`server is running on ${port}`);
})