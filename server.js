
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const uri = "mongodb+srv://jeremiahmcarthurb:kLlFrxOkT3yuK4J7@nhl25-cluster.eeb0qwu.mongodb.net/?retryWrites=true&w=majority&appName=nhl25-cluster";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("nhl25");
    const teamsCollection = db.collection("teams");

    // Register a team
    app.post('/register', async (req, res) => {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Team name required" });
      }

      // Check for duplicates
      const existing = await teamsCollection.findOne({ name });
      if (existing) {
        return res.status(409).json({ message: "Team name already registered" });
      }

      await teamsCollection.insertOne({ name });
      res.status(201).json({ message: "Team registered successfully" });
    });

    // Get all teams (admin only)
    app.get('/teams', async (req, res) => {
      const teams = await teamsCollection.find().toArray();
      res.json(teams);
    });

    app.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
    });
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
  }
}

main();
